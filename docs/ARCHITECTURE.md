# Swarm Conductor Architecture

## System Overview

Swarm Conductor is a distributed system for orchestrating AI agents from mobile devices. It uses a microservices architecture with clear separation between API, agent orchestration, and mobile client layers.

## Core Principles

1. **100% Free Open Source Software** - No proprietary dependencies
2. **Mobile-First** - Optimized for mobile control and monitoring
3. **Real-Time by Default** - WebSocket-driven state updates
4. **Horizontally Scalable** - Stateless services with Redis-backed state
5. **Fail-Safe** - Circuit breakers, graceful degradation, health checks
6. **Cost-Aware** - Built-in usage tracking and spending controls

## Technology Stack Rationale

### Backend Runtime: Node.js 20 LTS

**Why Node.js:**
- Non-blocking I/O ideal for WebSocket connections
- Single language (TypeScript) across backend and mobile
- Excellent ecosystem for real-time applications (Socket.io)
- Native async/await for agent coordination
- Strong JSON handling for API responses

**Alternatives Considered:**
- Python: Slower WebSocket performance, GIL limitations
- Go: Different language for frontend team, smaller ecosystem
- Rust: Steeper learning curve, slower development velocity

### Database: PostgreSQL 16

**Why PostgreSQL:**
- ACID compliance for billing transactions
- Robust JSONB support for flexible agent metadata
- Proven scalability for SaaS applications
- Excellent indexing for complex queries
- Row-level security for multi-tenancy
- pgvector extension available for future AI features

**Schema Design:**
```sql
-- Multi-tenant with organization-based partitioning
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan_tier VARCHAR(50) NOT NULL, -- starter, pro, enterprise
  member_limit INTEGER NOT NULL DEFAULT 5,
  agent_hour_limit INTEGER NOT NULL DEFAULT 100,
  overflow_enabled BOOLEAN DEFAULT false,
  overflow_cap DECIMAL(10,2), -- max monthly spend
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- owner, admin, member
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- master, sub
  status VARCHAR(50) NOT NULL, -- idle, active, spawning, terminating, failed
  parent_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  config JSONB, -- agent-specific configuration
  metadata JSONB, -- runtime metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_org_status ON agents(organization_id, status);
CREATE INDEX idx_agents_parent ON agents(parent_agent_id);

CREATE TABLE heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- healthy, degraded, unhealthy
  cpu_percent DECIMAL(5,2),
  memory_mb INTEGER,
  active_tasks INTEGER,
  last_error TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heartbeats_agent_time ON heartbeats(agent_id, recorded_at DESC);

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  usage_type VARCHAR(50) NOT NULL, -- agent_hour, api_call, storage_gb
  quantity DECIMAL(10,4) NOT NULL,
  unit_cost DECIMAL(10,4),
  total_cost DECIMAL(10,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_org_time ON usage_records(organization_id, recorded_at DESC);

CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- subscription_created, payment_succeeded, payment_failed
  stripe_event_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Cache & Message Queue: Redis 7

**Why Redis:**
- Sub-millisecond latency for session storage
- Pub/Sub for real-time event broadcasting
- Streams for durable message queues (BullMQ backend)
- Sorted sets for leaderboards and time-series data
- Atomic operations for distributed locks

**Usage Patterns:**
```
# Session storage
session:{userId} -> JWT token data (TTL: 7 days)

# Agent state cache
agent:{agentId}:status -> current status (TTL: 5 minutes)
agent:{agentId}:metrics -> latest metrics HASH

# Real-time subscriptions
org:{orgId}:events -> Pub/Sub channel for WebSocket broadcasting

# Rate limiting
ratelimit:{userId}:{endpoint} -> request count (TTL: 1 minute)

# BullMQ queues
bull:{queueName}:* -> Job queue data structures
```

### Job Queue: BullMQ

**Why BullMQ:**
- Built on Redis for reliability
- Automatic retries with exponential backoff
- Job prioritization and delayed jobs
- Progress tracking and event hooks
- Rate limiting per queue
- Excellent TypeScript support

**Queue Architecture:**
```typescript
// Agent task queue
interface AgentTask {
  type: 'spawn' | 'execute' | 'terminate';
  agentId: string;
  organizationId: string;
  payload: Record<string, unknown>;
  priority?: number;
}

// Queues:
// - agent-tasks: High-priority agent operations
// - heartbeat-checks: Background health monitoring
// - billing-calculations: Usage aggregation
// - notifications: Email/push notifications
```

### API Framework: Express.js

**Why Express:**
- Minimal and unopinionated
- Massive middleware ecosystem
- Easy integration with Socket.io
- Well-documented and stable
- TypeScript support via @types/express

**Alternatives:**
- Fastify: Less Socket.io integration examples
- NestJS: Too opinionated, heavier framework
- Koa: Smaller ecosystem, less middleware

### WebSocket: Socket.io

**Why Socket.io:**
- Automatic reconnection and fallbacks
- Room-based broadcasting (per organization)
- Built-in binary support
- Middleware for authentication
- Event acknowledgments
- Production-tested at scale

**Event Structure:**
```typescript
// Client -> Server
interface ClientEvents {
  'agent:spawn': (payload: SpawnAgentPayload) => void;
  'agent:terminate': (agentId: string) => void;
  'subscribe:org': (orgId: string) => void;
}

// Server -> Client
interface ServerEvents {
  'agent:status_changed': (data: AgentStatusUpdate) => void;
  'heartbeat:update': (data: HeartbeatData) => void;
  'usage:alert': (data: UsageAlert) => void;
  'billing:event': (data: BillingEvent) => void;
}
```

### ORM: Drizzle ORM

**Why Drizzle:**
- TypeScript-first with full type inference
- Zero runtime overhead (compiles to SQL)
- Automatic migration generation
- Works with raw SQL when needed
- No decorators or entity classes
- Excellent PostgreSQL support

**Alternatives:**
- Prisma: Runtime overhead, less control
- TypeORM: Decorator-heavy, dated patterns
- Knex: No type safety, manual types

### Validation: Zod

**Why Zod:**
- Runtime and compile-time type safety
- Composable schemas
- Automatic TypeScript type inference
- Great error messages
- Works seamlessly with Express and React Hook Form

```typescript
import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(3).max(100),
  type: z.enum(['master', 'sub']),
  config: z.record(z.unknown()).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
```

### Mobile Framework: Expo

**Why Expo:**
- Managed workflow for faster development
- OTA updates without app store review
- Cross-platform (iOS + Android) from single codebase
- Excellent developer experience
- Strong community and documentation
- Easy CI/CD with EAS Build

**Key Libraries:**
- **TanStack Query** (React Query): Server state management, caching, optimistic updates
- **Zustand**: Lightweight local state (UI state, auth tokens)
- **React Navigation**: Type-safe navigation
- **React Hook Form**: Performant forms with Zod validation
- **Socket.io-client**: Real-time WebSocket connection
- **React Native Paper**: Material Design components

## Service Architecture

### API Server (`packages/api`)

**Responsibilities:**
- REST API for CRUD operations
- JWT authentication and authorization
- WebSocket connection management
- Stripe webhook handling
- Request validation and rate limiting

**Structure:**
```
api/
├── src/
│   ├── routes/
│   │   ├── auth.ts          # POST /auth/register, /auth/login
│   │   ├── organizations.ts # CRUD for teams
│   │   ├── agents.ts        # Agent lifecycle endpoints
│   │   ├── billing.ts       # Subscription management
│   │   └── webhooks.ts      # Stripe webhooks
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── agent.service.ts
│   │   ├── billing.service.ts
│   │   └── queue.service.ts
│   ├── middleware/
│   │   ├── authenticate.ts  # JWT verification
│   │   ├── authorize.ts     # Role-based access
│   │   ├── validate.ts      # Zod schema validation
│   │   └── ratelimit.ts     # Redis-backed rate limiting
│   ├── websocket/
│   │   ├── server.ts        # Socket.io setup
│   │   ├── handlers.ts      # Event handlers
│   │   └── middleware.ts    # Socket authentication
│   ├── db/
│   │   ├── schema.ts        # Drizzle schema definitions
│   │   ├── client.ts        # Database connection
│   │   └── migrations/      # SQL migration files
│   └── index.ts             # Express app entry point
```

### Agent System (`packages/agents`)

**Responsibilities:**
- Master agent coordination
- Sub-agent spawning and lifecycle
- OpenClaw integration
- Task execution and delegation
- Heartbeat emission

**Structure:**
```
agents/
├── src/
│   ├── master/
│   │   ├── coordinator.ts   # Main orchestration logic
│   │   ├── spawner.ts       # Sub-agent spawning
│   │   └── scheduler.ts     # Task prioritization
│   ├── worker/
│   │   ├── executor.ts      # Sub-agent task execution
│   │   ├── lifecycle.ts     # Startup/shutdown hooks
│   │   └── openclaw.ts      # OpenClaw wrapper
│   ├── heartbeat/
│   │   ├── monitor.ts       # Health check service
│   │   ├── collector.ts     # Metrics collection
│   │   └── alerter.ts       # Failure detection
│   ├── queue/
│   │   ├── consumer.ts      # BullMQ job consumer
│   │   └── producer.ts      # Job creation helpers
│   └── index.ts             # Agent system entry point
```

**Master Agent Flow:**
```
1. Receives task from BullMQ queue
2. Analyzes task complexity and requirements
3. Decides: execute directly OR spawn sub-agents
4. If spawning:
   - Creates sub-agent records in database
   - Emits spawn jobs to queue
   - Monitors sub-agent status via heartbeat
5. Aggregates results from sub-agents
6. Returns final result to API
```

**Sub-Agent Lifecycle:**
```
SPAWNING -> ACTIVE -> (IDLE | TERMINATING) -> TERMINATED
           │
           └─> FAILED (retry or escalate to master)
```

### Heartbeat Service

**Purpose:** Independent monitoring of all agents

**Implementation:**
```typescript
class HeartbeatMonitor {
  private interval = 30_000; // 30 seconds
  
  async start() {
    setInterval(() => this.checkAllAgents(), this.interval);
  }
  
  async checkAllAgents() {
    const agents = await getActiveAgents();
    
    for (const agent of agents) {
      const health = await this.checkHealth(agent);
      await this.recordHeartbeat(agent.id, health);
      
      if (health.status === 'unhealthy') {
        await this.handleUnhealthyAgent(agent);
      }
    }
  }
  
  async handleUnhealthyAgent(agent: Agent) {
    // 1. Increment failure count
    // 2. If failures < 3: restart agent
    // 3. If failures >= 3: escalate to master or alert team
    // 4. Broadcast status to WebSocket clients
  }
}
```

## Data Flow Examples

### User Spawns Agent from Mobile App

```
1. Mobile: User taps "Deploy Agent"
2. Mobile: POST /api/agents {name, type, config}
3. API: Validate JWT and organization membership
4. API: Check billing limits (member count, agent hours)
5. API: Create agent record in PostgreSQL (status: spawning)
6. API: Enqueue spawn job to BullMQ
7. API: Return agent object to mobile
8. Agent System: Consume spawn job
9. Agent System: Initialize agent process
10. Agent System: Update status to "active"
11. WebSocket: Broadcast agent:status_changed to org room
12. Mobile: Receive real-time update, UI reflects active agent
13. Heartbeat: Begin monitoring new agent
```

### Billing Calculation Flow

```
1. Agent System: Track compute time for each agent
2. Agent System: Write usage_records to PostgreSQL every 5 minutes
3. Billing Service: Aggregate usage daily via cron job
4. Billing Service: Calculate costs based on plan tier
5. Billing Service: Check against spending limits
6. If limit exceeded and overflow disabled:
   - Pause non-critical agents
   - Send alert to team owner
7. If limit exceeded and overflow enabled:
   - Continue but send warning at 80%, 100%, cap
8. Monthly: Stripe creates invoice from metered usage
9. Webhook: payment_succeeded -> update billing_events
10. WebSocket: Broadcast billing:event to org
```

## Security Considerations

### Authentication
- JWTs with 7-day expiration
- Refresh tokens stored in PostgreSQL
- Bcrypt with cost factor 12 for password hashing
- Rate limiting on auth endpoints (5 attempts per minute)

### Authorization
- Role-based access control (owner, admin, member)
- Row-level security in PostgreSQL for multi-tenancy
- Organization-scoped all API operations
- WebSocket rooms restricted by organization membership

### API Security
- Helmet.js for HTTP header security
- CORS with whitelist
- Request size limits (10MB max)
- SQL injection protection via parameterized queries (Drizzle)
- XSS protection via input sanitization
- Rate limiting per user and endpoint

### Secrets Management
- Environment variables for all secrets
- No secrets in code or logs
- Stripe webhook signature verification
- Agent API keys rotated monthly

## Scalability Strategy

### Horizontal Scaling

**API Server:**
- Stateless design allows multiple instances
- Load balancer (Caddy) distributes requests
- Session data in Redis (shared state)
- WebSocket sticky sessions via IP hash

**Agent System:**
- Multiple worker instances consume from BullMQ
- Each worker can run multiple agents
- Master agents assigned by consistent hashing
- Auto-scaling based on queue depth

**Database:**
- PostgreSQL read replicas for queries
- Connection pooling (pg-pool)
- Partitioning by organization_id for large tables
- Indexing on common query patterns

### Performance Targets

- API response time: p95 < 200ms
- WebSocket message latency: < 100ms
- Agent spawn time: < 5 seconds
- Database query time: p95 < 50ms
- Heartbeat interval: 30 seconds
- Support 1000+ concurrent WebSocket connections per server

## Monitoring & Observability

### Metrics (Prometheus)
- HTTP request duration by endpoint
- WebSocket connection count
- Active agents by status
- BullMQ queue depth and processing time
- Database connection pool usage
- Redis memory usage

### Logging (Winston + Loki)
- Structured JSON logs
- Log levels: error, warn, info, debug
- Request/response logging with correlation IDs
- Agent lifecycle events
- Billing events

### Dashboards (Grafana)
- System overview (requests, errors, latency)
- Agent status (active, failed, avg lifetime)
- Billing metrics (usage by org, revenue)
- Infrastructure health (CPU, memory, disk)

### Alerting
- High error rate (> 5% for 5 minutes)
- Agent failure rate (> 20% in 10 minutes)
- Database slow queries (> 1s)
- High queue depth (> 1000 jobs)
- Billing failures

## Deployment Architecture

### Development
```
Docker Compose:
- api: Node.js API server
- agents: Agent system
- postgres: PostgreSQL 16
- redis: Redis 7
- caddy: Reverse proxy
```

### Production
```
Cloud Provider (AWS/GCP/DigitalOcean):
- Compute: Docker containers on VM instances
- Database: Managed PostgreSQL (RDS/Cloud SQL)
- Cache: Managed Redis (ElastiCache/MemoryStore)
- Storage: Object storage for logs (S3/GCS)
- CDN: Cloudflare for static assets
- Monitoring: Self-hosted Prometheus + Grafana
```

## Future Enhancements

1. **Agent Templates**: Pre-configured agent types for common tasks
2. **Multi-Region**: Deploy agents closer to users
3. **Agent Marketplace**: Share and monetize custom agents
4. **Advanced Monitoring**: ML-based anomaly detection
5. **Cost Optimization**: Automatic agent hibernation during idle
6. **Collaboration**: Real-time multi-user agent control
7. **API Keys**: Programmatic access for power users
8. **Webhooks**: Custom event notifications

## License

All architectural decisions prioritize FOSS components to ensure:
- No vendor lock-in
- Community-driven improvements
- Cost-effective scaling
- Full control and customization
- Transparent security practices