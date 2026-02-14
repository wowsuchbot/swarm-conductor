# Database Schema Documentation

## Overview

Swarm Conductor uses PostgreSQL 16 as its primary database. The schema is designed for multi-tenancy with organization-based partitioning and supports ACID transactions for billing operations.

## Schema Management

- **ORM:** Drizzle ORM for type-safe queries
- **Migrations:** Drizzle Kit for migration generation and execution
- **Connection Pooling:** pg-pool with max 20 connections per instance

## Entity Relationship Diagram

```
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────────────┐
│ organization_members│◄────────┐
└──────┬──────────────┘         │
       │                        │ N:1
       │ N:1                    │
       ▼                  ┌─────┴──────────┐
┌──────────────┐          │ organizations  │
│organizations │          └─────┬──────────┘
└──────┬───────┘                │
       │                        │ 1:N
       │ 1:N                    ▼
       │                  ┌─────────────────┐
       │                  │ billing_events  │
       │                  └─────────────────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│    agents    │
└──────┬───────┘
       │
       ├─────► 1:N ───────┐
       │                  ▼
       │            ┌─────────────┐
       │            │ heartbeats  │
       │            └─────────────┘
       │
       ├─────► 1:N ───────┐
       │                  ▼
       │            ┌──────────────┐
       │            │usage_records │
       │            └──────────────┘
       │
       └─────► self-reference (parent_agent_id)
```

## Core Tables

### users

Stores user authentication and profile information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

COMMENT ON TABLE users IS 'User accounts and authentication';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hash with cost factor 12';
```

**Constraints:**
- `email` must be valid email format (enforced by application)
- `password_hash` stored using bcrypt
- `email_verified` for future email confirmation feature

---

### organizations

Team/workspace entities that own agents and billing.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan_tier VARCHAR(50) NOT NULL DEFAULT 'starter',
  member_limit INTEGER NOT NULL DEFAULT 5,
  agent_hour_limit INTEGER NOT NULL DEFAULT 100,
  overflow_enabled BOOLEAN DEFAULT false,
  overflow_cap DECIMAL(10,2),
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(50),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_plan_tier CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  CONSTRAINT chk_member_limit CHECK (member_limit > 0),
  CONSTRAINT chk_agent_hour_limit CHECK (agent_hour_limit >= 0),
  CONSTRAINT chk_overflow_cap CHECK (overflow_cap IS NULL OR overflow_cap > 0),
  CONSTRAINT chk_subscription_status CHECK (
    subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')
  )
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX idx_organizations_plan_tier ON organizations(plan_tier);

COMMENT ON TABLE organizations IS 'Teams/workspaces with billing configuration';
COMMENT ON COLUMN organizations.overflow_cap IS 'Maximum monthly spend in dollars, NULL for unlimited';
```

**Plan Tiers:**
- `starter`: 5 members, 100 agent hours, $49/month
- `pro`: 20 members, 500 agent hours, $199/month
- `enterprise`: Custom limits, custom pricing

---

### organization_members

Join table for user-organization relationships with roles.

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  UNIQUE(organization_id, user_id),
  CONSTRAINT chk_role CHECK (role IN ('owner', 'admin', 'member'))
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

COMMENT ON TABLE organization_members IS 'User memberships in organizations';
COMMENT ON COLUMN organization_members.role IS 'owner: full control, admin: manage members, member: view only';
```

**Role Hierarchy:**
- `owner`: Create/delete org, manage billing, full admin rights (1 per org)
- `admin`: Invite/remove members, create/delete agents, view billing
- `member`: View agents, execute tasks, view usage

---

### agents

Agent instances (master and sub-agents).

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'spawning',
  parent_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  process_id INTEGER,
  last_active_at TIMESTAMPTZ,
  spawn_started_at TIMESTAMPTZ,
  spawn_completed_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_agent_type CHECK (type IN ('master', 'sub')),
  CONSTRAINT chk_agent_status CHECK (
    status IN ('spawning', 'idle', 'active', 'terminating', 'terminated', 'failed')
  ),
  CONSTRAINT chk_master_no_parent CHECK (
    (type = 'master' AND parent_agent_id IS NULL) OR type = 'sub'
  )
);

CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_agents_org_status ON agents(organization_id, status);
CREATE INDEX idx_agents_parent ON agents(parent_agent_id) WHERE parent_agent_id IS NOT NULL;
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_active ON agents(organization_id, last_active_at) WHERE status IN ('idle', 'active');
CREATE INDEX idx_agents_config ON agents USING GIN(config);

COMMENT ON TABLE agents IS 'Agent instances (master coordinators and sub-agents)';
COMMENT ON COLUMN agents.config IS 'Agent configuration (model, temperature, tools, etc.)';
COMMENT ON COLUMN agents.metadata IS 'Runtime metadata (tasks completed, errors, etc.)';
```

**Status Lifecycle:**
```
spawning → idle ⇄ active → terminating → terminated
    ↓                           ↓
  failed                      failed
```

**config JSONB Structure:**
```json
{
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "tools": ["web_search", "code_execution"],
  "systemPrompt": "You are a helpful assistant..."
}
```

**metadata JSONB Structure:**
```json
{
  "tasksCompleted": 42,
  "tasksFailed": 3,
  "totalComputeSeconds": 1234,
  "lastError": "Connection timeout",
  "errorCount": 1
}
```

---

### heartbeats

Agent health monitoring records.

```sql
CREATE TABLE heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  cpu_percent DECIMAL(5,2),
  memory_mb INTEGER,
  active_tasks INTEGER DEFAULT 0,
  queue_depth INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_heartbeat_status CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  CONSTRAINT chk_cpu_percent CHECK (cpu_percent >= 0 AND cpu_percent <= 100),
  CONSTRAINT chk_memory_mb CHECK (memory_mb >= 0),
  CONSTRAINT chk_active_tasks CHECK (active_tasks >= 0)
);

CREATE INDEX idx_heartbeats_agent_time ON heartbeats(agent_id, recorded_at DESC);
CREATE INDEX idx_heartbeats_status ON heartbeats(status, recorded_at DESC);

-- Partition by month for scalability
CREATE TABLE heartbeats_y2026m02 PARTITION OF heartbeats
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

COMMENT ON TABLE heartbeats IS 'Agent health check records (30s interval)';
COMMENT ON COLUMN heartbeats.status IS 'healthy: all good, degraded: slow/high resource, unhealthy: failing';
```

**Health Status Criteria:**
- `healthy`: CPU < 70%, memory < 80%, response < 1000ms, no errors
- `degraded`: CPU 70-90%, memory 80-95%, response 1000-3000ms, occasional errors
- `unhealthy`: CPU > 90%, memory > 95%, response > 3000ms, frequent errors

**Data Retention:**
- Keep detailed heartbeats for 30 days
- Aggregate hourly summaries for 1 year
- Delete older records via cron job

---

### usage_records

Billing usage tracking.

```sql
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  usage_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(10,4) NOT NULL,
  unit_cost DECIMAL(10,4) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  billing_period VARCHAR(7) NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_usage_type CHECK (
    usage_type IN ('agent_hour', 'api_call', 'storage_gb', 'additional_member')
  ),
  CONSTRAINT chk_quantity CHECK (quantity > 0),
  CONSTRAINT chk_unit_cost CHECK (unit_cost >= 0),
  CONSTRAINT chk_total_cost CHECK (total_cost >= 0),
  CONSTRAINT chk_billing_period CHECK (billing_period ~ '^\d{4}-\d{2}$')
);

CREATE INDEX idx_usage_org_period ON usage_records(organization_id, billing_period);
CREATE INDEX idx_usage_agent ON usage_records(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_usage_type ON usage_records(usage_type, recorded_at DESC);
CREATE INDEX idx_usage_recorded_at ON usage_records(recorded_at DESC);

COMMENT ON TABLE usage_records IS 'Usage tracking for billing calculations';
COMMENT ON COLUMN usage_records.billing_period IS 'Format: YYYY-MM';
```

**Usage Types & Pricing:**
- `agent_hour`: $0.15 per hour (calculated from compute seconds)
- `api_call`: $0.001 per call (future feature)
- `storage_gb`: $0.10 per GB per month (future feature)
- `additional_member`: $10 per member over limit

---

### billing_events

Stripe webhook and billing event log.

```sql
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  stripe_event_id VARCHAR(255) UNIQUE,
  stripe_object_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50),
  metadata JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_event_type CHECK (
    event_type IN (
      'subscription_created', 'subscription_updated', 'subscription_canceled',
      'invoice_created', 'invoice_paid', 'invoice_payment_failed',
      'payment_succeeded', 'payment_failed', 'refund_created'
    )
  )
);

CREATE INDEX idx_billing_org ON billing_events(organization_id, created_at DESC);
CREATE INDEX idx_billing_stripe_event ON billing_events(stripe_event_id);
CREATE INDEX idx_billing_type ON billing_events(event_type, created_at DESC);

COMMENT ON TABLE billing_events IS 'Stripe webhook events and billing history';
COMMENT ON COLUMN billing_events.stripe_event_id IS 'Stripe event ID for idempotency';
```

---

### refresh_tokens

JWT refresh token storage.

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  device_info JSONB,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of refresh token';
```

**Token Lifecycle:**
- Access tokens: 15 minutes expiry
- Refresh tokens: 7 days expiry
- Refresh tokens are single-use (revoked on refresh)

---

## Aggregated Views

### organization_usage_summary

Real-time usage summary per organization.

```sql
CREATE VIEW organization_usage_summary AS
SELECT 
  o.id AS organization_id,
  o.name AS organization_name,
  o.plan_tier,
  COUNT(DISTINCT om.user_id) AS current_members,
  o.member_limit,
  COUNT(DISTINCT CASE WHEN a.status IN ('idle', 'active') THEN a.id END) AS active_agents,
  COALESCE(SUM(CASE 
    WHEN ur.billing_period = TO_CHAR(CURRENT_DATE, 'YYYY-MM') 
    AND ur.usage_type = 'agent_hour'
    THEN ur.quantity 
    ELSE 0 
  END), 0) AS current_month_agent_hours,
  o.agent_hour_limit,
  COALESCE(SUM(CASE 
    WHEN ur.billing_period = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    THEN ur.total_cost 
    ELSE 0 
  END), 0) AS current_month_cost,
  o.overflow_cap,
  o.overflow_enabled
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_id
LEFT JOIN agents a ON o.id = a.organization_id
LEFT JOIN usage_records ur ON o.id = ur.organization_id
GROUP BY o.id, o.name, o.plan_tier, o.member_limit, o.agent_hour_limit, o.overflow_cap, o.overflow_enabled;

COMMENT ON VIEW organization_usage_summary IS 'Current usage metrics per organization';
```

---

### agent_health_summary

Latest health status for all agents.

```sql
CREATE VIEW agent_health_summary AS
SELECT DISTINCT ON (a.id)
  a.id AS agent_id,
  a.name AS agent_name,
  a.organization_id,
  a.type,
  a.status,
  h.status AS health_status,
  h.cpu_percent,
  h.memory_mb,
  h.active_tasks,
  h.response_time_ms,
  h.recorded_at AS last_heartbeat_at,
  EXTRACT(EPOCH FROM (NOW() - h.recorded_at)) AS seconds_since_heartbeat
FROM agents a
LEFT JOIN heartbeats h ON a.id = h.agent_id
WHERE a.status NOT IN ('terminated', 'failed')
ORDER BY a.id, h.recorded_at DESC NULLS LAST;

COMMENT ON VIEW agent_health_summary IS 'Latest health status for active agents';
```

---

## Functions and Triggers

### Update Timestamp Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Enforce Single Owner Per Organization

```sql
CREATE OR REPLACE FUNCTION enforce_single_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'owner' THEN
    IF EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_id = NEW.organization_id 
      AND role = 'owner' 
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Organization can only have one owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_owner_trigger
BEFORE INSERT OR UPDATE ON organization_members
FOR EACH ROW EXECUTE FUNCTION enforce_single_owner();
```

---

### Calculate Usage Cost Trigger

```sql
CREATE OR REPLACE FUNCTION calculate_usage_cost()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_cost = NEW.quantity * NEW.unit_cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_usage_cost_trigger
BEFORE INSERT OR UPDATE ON usage_records
FOR EACH ROW EXECUTE FUNCTION calculate_usage_cost();
```

---

## Indexes for Performance

### Composite Indexes

```sql
-- Frequently queried organization + status combinations
CREATE INDEX idx_agents_org_status_created ON agents(organization_id, status, created_at DESC);

-- Usage aggregation by period
CREATE INDEX idx_usage_period_type ON usage_records(billing_period, usage_type, organization_id);

-- Heartbeat time-series queries
CREATE INDEX idx_heartbeats_time_status ON heartbeats(recorded_at DESC, status);

-- Member lookup with role filtering
CREATE INDEX idx_members_org_role_user ON organization_members(organization_id, role, user_id);
```

### GIN Indexes for JSONB

```sql
-- Search agent config
CREATE INDEX idx_agents_config_gin ON agents USING GIN(config jsonb_path_ops);

-- Search agent metadata
CREATE INDEX idx_agents_metadata_gin ON agents USING GIN(metadata jsonb_path_ops);
```

---

## Data Retention Policies

### Heartbeat Cleanup

```sql
-- Delete heartbeats older than 30 days (keep hourly aggregates)
CREATE OR REPLACE FUNCTION cleanup_old_heartbeats()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM heartbeats 
  WHERE recorded_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule: Run daily at 2 AM UTC
```

### Revoked Token Cleanup

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM refresh_tokens 
  WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Migration Strategy

### Initial Setup

```bash
# Generate migration from schema
pnpm drizzle-kit generate

# Apply migration
pnpm drizzle-kit migrate
```

### Adding New Tables

```typescript
// packages/api/src/db/schema.ts
export const newTable = pgTable('new_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  // ... columns
});

// Generate migration
pnpm drizzle-kit generate

// Review migration file in packages/api/src/db/migrations/
// Apply migration
pnpm drizzle-kit migrate
```

### Rollback Strategy

```sql
-- Each migration includes DOWN migration
-- Example: 0001_create_users.down.sql
DROP TABLE IF EXISTS users CASCADE;
```

---

## Backup and Recovery

### Daily Backups

```bash
# Full database backup
pg_dump -h localhost -U postgres swarm_conductor > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U postgres swarm_conductor | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Point-in-Time Recovery

- Enable WAL archiving in PostgreSQL
- Continuous archiving to S3/GCS
- Restore to any point within retention period (7 days)

### Restore

```bash
# Restore from backup
psql -h localhost -U postgres -d swarm_conductor < backup_20260214.sql

# Verify data integrity
psql -h localhost -U postgres -d swarm_conductor -c "SELECT COUNT(*) FROM users;"
```

---

## Performance Optimization

### Connection Pooling

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
});
```

### Query Optimization

- Use prepared statements for repeated queries
- Batch inserts for usage records (use `INSERT ... VALUES (...), (...)`)
- Avoid N+1 queries (use JOINs or Drizzle's with())
- Use materialized views for complex aggregations

### Monitoring

```sql
-- Slow query log (postgresql.conf)
log_min_duration_statement = 1000  # Log queries > 1s

-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;  # Unused indexes
```

---

## Security Considerations

### Row-Level Security (Future)

```sql
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_org_isolation ON agents
USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### Encrypted Columns (Future)

- Use pgcrypto for sensitive data
- Encrypt Stripe customer IDs, API keys
- Application-level encryption for config secrets

### Audit Logging (Future)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100),
  operation VARCHAR(10),  -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```