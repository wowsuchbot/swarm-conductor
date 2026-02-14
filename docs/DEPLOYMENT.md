# Production Deployment Guide

## Overview

This guide covers deploying Swarm Conductor to production using Docker containers on cloud infrastructure. All components use free and open-source software.

## Architecture Options

### Option 1: Single Server (Small Scale)

**Suitable for:**
- Up to 100 organizations
- Up to 1000 concurrent agents
- Budget: $40-80/month

**Infrastructure:**
- 1x VM: 4 vCPU, 8GB RAM (API + Agents)
- Managed PostgreSQL: 2 vCPU, 4GB RAM
- Managed Redis: 1GB memory

### Option 2: Multi-Server (Medium Scale)

**Suitable for:**
- Up to 1000 organizations
- Up to 10,000 concurrent agents
- Budget: $200-400/month

**Infrastructure:**
- 2x VM: 4 vCPU, 8GB RAM (API servers behind load balancer)
- 2x VM: 4 vCPU, 16GB RAM (Agent workers)
- Managed PostgreSQL: 4 vCPU, 16GB RAM
- Managed Redis: 4GB memory
- Load Balancer

### Option 3: Kubernetes (Large Scale)

**Suitable for:**
- 1000+ organizations
- 10,000+ concurrent agents
- Budget: $500+/month

**Infrastructure:**
- Kubernetes cluster (3+ nodes)
- Auto-scaling enabled
- Managed databases
- CDN for static assets

---

## Pre-Deployment Checklist

- [ ] Domain name registered and DNS configured
- [ ] SSL certificates obtained (Let's Encrypt via Caddy)
- [ ] Cloud account set up (AWS/GCP/DigitalOcean)
- [ ] Stripe account configured with production keys
- [ ] Environment variables prepared
- [ ] Database backups configured
- [ ] Monitoring tools set up
- [ ] Error tracking configured (optional: Sentry)

---

## Cloud Provider Setup

### DigitalOcean (Recommended for Simplicity)

**Advantages:**
- Simple pricing
- Good performance
- Managed databases included
- Built-in monitoring

**Setup Steps:**

1. **Create Droplets (VMs)**

```bash
# API Server Droplet
Size: 4 vCPU, 8GB RAM ($48/month)
OS: Ubuntu 22.04 LTS
Datacenter: Choose closest to users

# Agent Worker Droplet
Size: 4 vCPU, 16GB RAM ($96/month)
OS: Ubuntu 22.04 LTS
```

2. **Create Managed Database**

```bash
# PostgreSQL
Size: 2 vCPU, 4GB RAM ($60/month)
Version: 16
Enable automatic backups (daily)

# Redis
Size: 1GB memory ($15/month)
Enable automatic backups
```

3. **Configure Firewall**

```bash
# API Server
Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS)
Internal: 3000 (API), 6379 (Redis)

# Agent Worker
Allow: 22 (SSH)
Internal: 5432 (PostgreSQL), 6379 (Redis)
```

### AWS (Most Flexible)

**Services:**
- EC2: Compute instances
- RDS: PostgreSQL database
- ElastiCache: Redis
- S3: Static assets and backups
- CloudWatch: Monitoring
- ALB: Application Load Balancer

**Estimated Cost:** $150-300/month for medium scale

### GCP (Good Balance)

**Services:**
- Compute Engine: VMs
- Cloud SQL: PostgreSQL
- Memorystore: Redis
- Cloud Storage: Backups
- Cloud Monitoring
- Cloud Load Balancing

**Estimated Cost:** $160-320/month for medium scale

---

## Server Setup

### 1. Initial Server Configuration

Run on each VM:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js (for building)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Create deployment user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
```

### 2. Clone and Build Application

```bash
# Switch to deploy user
sudo su - deploy

# Clone repository
git clone https://github.com/wowsuchbot/swarm-conductor.git
cd swarm-conductor

# Checkout production branch/tag
git checkout main  # or specific tag like v1.0.0

# Install dependencies
pnpm install --frozen-lockfile

# Build all packages
pnpm build
```

### 3. Environment Variables

Create production environment files:

#### `/home/deploy/swarm-conductor/.env.production`

```bash
# Environment
NODE_ENV=production

# API Server
PORT=3000
API_BASE_URL=https://api.yourdomain.com

# Database (Managed PostgreSQL)
DATABASE_URL=postgresql://user:password@managed-db-host:25060/swarm_conductor?sslmode=require
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
DATABASE_SSL=true

# Redis (Managed Redis)
REDIS_URL=rediss://managed-redis-host:25061
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true

# JWT (Generate strong secrets)
JWT_SECRET=<generated-256-bit-secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<generated-256-bit-secret>
REFRESH_TOKEN_EXPIRES_IN=7d

# Stripe (Production Keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# CORS
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring (optional)
SENTRY_DSN=https://...
```

**Generate Secrets:**

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Docker Compose Production Config

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  api:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
      args:
        NODE_ENV: production
    image: swarm-conductor-api:latest
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  agents:
    build:
      context: .
      dockerfile: packages/agents/Dockerfile
      args:
        NODE_ENV: production
    image: swarm-conductor-agents:latest
    restart: unless-stopped
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '3'
          memory: 12G
        reservations:
          cpus: '2'
          memory: 8G

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/caddy/Caddyfile.prod:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api

volumes:
  caddy_data:
  caddy_config:
```

### 5. Caddy Reverse Proxy Configuration

Create `infrastructure/caddy/Caddyfile.prod`:

```
api.yourdomain.com {
    reverse_proxy api:3000
    
    encode gzip
    
    header {
        -Server
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
    }
    
    log {
        output file /var/log/caddy/access.log
        format json
    }
    
    # Rate limiting
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 1000
            window 1m
        }
    }
}

# WebSocket endpoint
wss://api.yourdomain.com {
    reverse_proxy api:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## Database Setup

### 1. Run Migrations

```bash
cd packages/api

# Set production database URL
export DATABASE_URL="postgresql://..."

# Run migrations
pnpm db:migrate

# Verify
psql $DATABASE_URL -c "\dt"
```

### 2. Configure Backups

**Managed Database:** Enable automatic daily backups

**Manual Backup Script:**

```bash
#!/bin/bash
# /home/deploy/scripts/backup-db.sh

BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="swarm_conductor_$DATE.sql.gz"

pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/$FILENAME"

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/$FILENAME" s3://your-backup-bucket/db-backups/

# Keep only last 7 days locally
find $BACKUP_DIR -name "swarm_conductor_*.sql.gz" -mtime +7 -delete
```

**Cron Job:**

```bash
# Run daily at 2 AM
0 2 * * * /home/deploy/scripts/backup-db.sh
```

---

## Deployment Process

### Initial Deployment

```bash
# 1. Build and start services
cd /home/deploy/swarm-conductor
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 2. Check logs
docker-compose -f docker-compose.prod.yml logs -f

# 3. Verify health
curl https://api.yourdomain.com/health
```

### Zero-Downtime Updates

```bash
#!/bin/bash
# /home/deploy/scripts/deploy.sh

set -e

cd /home/deploy/swarm-conductor

# Pull latest code
git fetch origin
git checkout $1  # Tag or branch name

# Install dependencies
pnpm install --frozen-lockfile

# Build
pnpm build

# Build new Docker images
docker-compose -f docker-compose.prod.yml build

# Rolling restart
for service in api agents; do
    echo "Updating $service..."
    docker-compose -f docker-compose.prod.yml up -d --no-deps --scale $service=2 $service
    sleep 10
    docker-compose -f docker-compose.prod.yml up -d --no-deps --scale $service=1 $service
done

# Cleanup old images
docker image prune -f

echo "Deployment complete!"
```

**Usage:**

```bash
./scripts/deploy.sh v1.1.0
```

### Rollback

```bash
#!/bin/bash
# /home/deploy/scripts/rollback.sh

cd /home/deploy/swarm-conductor

# Get previous tag
PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^)

echo "Rolling back to $PREVIOUS_TAG"
git checkout $PREVIOUS_TAG

# Redeploy
./scripts/deploy.sh $PREVIOUS_TAG
```

---

## Monitoring

### Prometheus Setup

Create `infrastructure/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'swarm-api'
    static_configs:
      - targets: ['api:3000']

  - job_name: 'swarm-agents'
    static_configs:
      - targets: ['agents:9090']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

Add to `docker-compose.prod.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./infrastructure/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    volumes:
      - grafana_data:/var/lib/grafana
      - ./infrastructure/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=<secure-password>
      - GF_INSTALL_PLUGINS=redis-datasource
```

### Health Check Endpoint

API implements `/health` endpoint:

```typescript
// packages/api/src/routes/health.ts
import { Router } from 'express';
import { db } from '../db/client';
import { redis } from '../lib/redis';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    await db.execute('SELECT 1');
    health.checks.database = 'healthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    await redis.ping();
    health.checks.redis = 'healthy';
  } catch (error) {
    health.checks.redis = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
```

### Uptime Monitoring

Use free services:
- **UptimeRobot** (50 monitors free)
- **BetterStack** (10 monitors free)
- **Cronitor** (5 monitors free)

Monitor:
- API health endpoint (every 1-5 minutes)
- Agent worker health
- Database connectivity
- Redis connectivity

---

## Logging

### Centralized Logging with Loki

Add to `docker-compose.prod.yml`:

```yaml
  loki:
    image: grafana/loki:latest
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - ./infrastructure/loki/loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki

  promtail:
    image: grafana/promtail:latest
    restart: unless-stopped
    volumes:
      - /var/log:/var/log
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./infrastructure/promtail/promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

### Log Rotation

```bash
# /etc/logrotate.d/swarm-conductor
/var/log/swarm-conductor/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 deploy deploy
}
```

---

## Security

### SSL/TLS

Caddy automatically obtains and renews Let's Encrypt certificates.

**Verify:**
```bash
curl -I https://api.yourdomain.com
# Should show HTTPS with valid certificate
```

### Firewall Rules

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Block direct access to application ports
sudo ufw deny 3000/tcp
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp
```

### Secrets Management

**Option 1: Environment Variables** (Simple)
- Store in `.env.production`
- Set proper file permissions: `chmod 600 .env.production`

**Option 2: Docker Secrets** (Better)
```yaml
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  db_password:
    file: ./secrets/db_password.txt

services:
  api:
    secrets:
      - jwt_secret
      - db_password
```

**Option 3: HashiCorp Vault** (Enterprise)
- Centralized secret management
- Dynamic secrets
- Audit logging

### Database Security

- Enable SSL/TLS connections
- Use strong passwords (32+ characters)
- Restrict access by IP
- Enable connection pooling
- Regular security updates

---

## Performance Optimization

### Caching Strategy

```typescript
// Redis caching example
import { redis } from '../lib/redis';

export async function getOrganization(id: string) {
  const cacheKey = `org:${id}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Query database
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(org));
  
  return org;
}
```

### CDN for Static Assets

Use Cloudflare (free tier):
- Automatic caching
- DDoS protection
- SSL
- Global distribution

### Database Optimization

```sql
-- Create appropriate indexes
CREATE INDEX CONCURRENTLY idx_agents_org_status 
ON agents(organization_id, status);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM agents WHERE organization_id = '...';

-- Vacuum regularly
VACUUM ANALYZE;
```

---

## Scaling

### Horizontal Scaling

**API Servers:**
```bash
# Scale to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Add load balancer (Caddy handles this)
```

**Agent Workers:**
```bash
# Scale to 5 workers
docker-compose -f docker-compose.prod.yml up -d --scale agents=5
```

### Database Scaling

- **Read Replicas:** For heavy read workloads
- **Connection Pooling:** Use PgBouncer
- **Partitioning:** Partition large tables by date

### Redis Scaling

- **Redis Cluster:** For high availability
- **Sentinel:** Automatic failover

---

## Disaster Recovery

### Backup Strategy

1. **Database:** Daily full backups, retain 30 days
2. **Application Code:** Git repository
3. **Configuration:** Stored in version control
4. **User Uploads:** S3 with versioning enabled

### Recovery Procedures

**Database Recovery:**
```bash
# Restore from backup
gunzip -c backup_20260214.sql.gz | psql $DATABASE_URL

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

**Application Recovery:**
```bash
# Re-deploy last known good version
git checkout v1.0.0
./scripts/deploy.sh v1.0.0
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Check error logs
- Monitor resource usage
- Verify backups completed

**Weekly:**
- Review slow query logs
- Check disk space
- Update dependencies (security patches)

**Monthly:**
- Review and optimize database
- Audit user access
- Test disaster recovery procedures
- Review and archive old logs

### System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Cleanup
docker system prune -a -f
```

---

## Cost Optimization

- Use managed databases (reduce ops overhead)
- Enable auto-scaling during off-peak hours
- Use spot instances for non-critical workloads
- Implement aggressive caching
- Archive old data to cheaper storage
- Monitor and optimize database queries
- Use CDN for static assets

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart service
docker-compose -f docker-compose.prod.yml restart api
```

### High CPU Usage

```bash
# Check resource usage
docker stats

# Identify problematic queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Support

For production issues:
- GitHub Issues: Bug reports
- Email: support@yourdomain.com
- Status Page: status.yourdomain.com