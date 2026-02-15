# Swarm Conductor Integration Guide

Comprehensive guide for integrating OpenClaw with Express backend and BullMQ job queue.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [OpenClaw Integration](#openclaw-integration)
3. [Express API Patterns](#express-api-patterns)
4. [BullMQ Job Queue](#bullmq-job-queue)
5. [Dashboard Integration](#dashboard-integration)
6. [Testing Guide](#testing-guide)
7. [Deployment](#deployment)

## Architecture Overview

### System Components

```
┌─────────────────┐
│  Dashboard UI   │ (React + Vite + Socket.IO)
│   Port 3001     │
└────────┬────────┘
         │ HTTP + WebSocket
         v
┌─────────────────┐
│  Express API    │ (REST + Socket.IO Server)
│   Port 3000     │
└────┬───────┬────┘
     │       │
     │       └──────> Redis (BullMQ)
     v
┌─────────────────┐
│    OpenClaw     │ (WebSocket Gateway + HTTP Tools)
│   Port 18789    │
└─────────────────┘
```

### Technology Stack

- **Backend**: Express.js 4.x (TypeScript)
- **Job Queue**: BullMQ 5.x + Redis 7.x
- **Real-time**: Socket.IO 4.x (bidirectional WebSocket)
- **OpenClaw**: WebSocket (Gateway) + HTTP (Tools API)
- **Frontend**: React 18 + Vite + TanStack Query
- **Database**: Drizzle ORM + PostgreSQL (agent persistence)

## OpenClaw Integration

### Connection Patterns

OpenClaw provides two integration interfaces:

#### 1. WebSocket Gateway (Primary)

**URL**: `ws://localhost:18789`  
**Protocol**: JSON-RPC over WebSocket  
**Auth**: Bearer token via `OPENCLAW_GATEWAY_TOKEN`

```typescript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:18789', {
  headers: {
    Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`
  }
});

ws.on('open', () => {
  console.log('Connected to OpenClaw Gateway');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Received:', message);
});
```

**Message Types**:
- `auth_success` - Authentication confirmed
- `tool_response` - Tool execution result
- `agent_event` - Agent lifecycle events
- `error` - Error messages

#### 2. HTTP Tools API (Direct Execution)

**URL**: `http://localhost:18789/tools/invoke`  
**Method**: POST  
**Auth**: Bearer token in header

```typescript
import axios from 'axios';

const response = await axios.post(
  'http://localhost:18789/tools/invoke',
  {
    tool: 'github-list-repos',
    parameters: { user: 'composio' }
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }
);
```

### Health Check Pattern

```typescript
export async function checkOpenClawHealth(): Promise<boolean> {
  try {
    // Option 1: WebSocket ping-pong
    const ws = new WebSocket('ws://localhost:18789', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    return new Promise((resolve) => {
      ws.on('open', () => {
        ws.close();
        resolve(true);
      });
      ws.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });
    
    // Option 2: HTTP health endpoint
    const response = await axios.get('http://localhost:18789/health', {
      timeout: 3000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}
```

### Error Handling

```typescript
ws.on('error', (error) => {
  console.error('[OpenClaw] Connection error:', error);
  // Implement exponential backoff reconnection
  scheduleReconnect();
});

ws.on('close', (code, reason) => {
  console.log(`[OpenClaw] Connection closed: ${code} ${reason}`);
  if (code !== 1000) { // Not normal closure
    scheduleReconnect();
  }
});

function scheduleReconnect(attempt = 1) {
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
  setTimeout(() => connectToOpenClaw(attempt + 1), delay);
}
```

## Express API Patterns

### RESTful Endpoints

#### Agent Management

```typescript
// GET /api/agents - List all agents
app.get('/api/agents', async (req, res) => {
  const agents = await db.select().from(agentTable);
  res.json({ agents });
});

// POST /api/agents - Create new agent
app.post('/api/agents', async (req, res) => {
  const { teamId, type } = req.body;
  
  const agent = await db.insert(agentTable).values({
    id: generateId(),
    teamId,
    type,
    status: 'idle',
    sessionKey: generateSessionKey(),
    createdAt: new Date()
  }).returning();
  
  // Emit WebSocket event
  io.emit('agent:created', agent[0]);
  
  res.json({ agent: agent[0] });
});

// DELETE /api/agents/:id - Terminate agent
app.delete('/api/agents/:id', async (req, res) => {
  await db.update(agentTable)
    .set({ status: 'terminated' })
    .where(eq(agentTable.id, req.params.id));
  
  io.emit('agent:terminated', { id: req.params.id });
  res.json({ success: true });
});
```

#### Task Delegation

```typescript
// POST /api/agents/:id/tasks - Delegate task to agent
app.post('/api/agents/:id/tasks', async (req, res) => {
  const { agentId } = req.params;
  const { task, priority } = req.body;
  
  // Add job to BullMQ queue
  const job = await taskQueue.add('execute-task', {
    agentId,
    task,
    timestamp: Date.now()
  }, {
    priority: priority || 1,
    removeOnComplete: 100,
    removeOnFail: 200
  });
  
  res.json({ jobId: job.id, status: 'queued' });
});
```

### WebSocket Events

```typescript
import { Server } from 'socket.io';

const io = new Server(server, {
  cors: { origin: 'http://localhost:3001' }
});

io.on('connection', (socket) => {
  console.log('[Socket.IO] Client connected:', socket.id);
  
  // Subscribe to specific agent updates
  socket.on('subscribe:agent', (agentId) => {
    socket.join(`agent:${agentId}`);
    console.log(`Client ${socket.id} subscribed to agent ${agentId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('[Socket.IO] Client disconnected:', socket.id);
  });
});

// Emit events from anywhere in the application
io.emit('agent:created', agent);
io.to(`agent:${agentId}`).emit('agent:task:completed', result);
```

### Health Endpoint

```typescript
app.get('/health', async (req, res) => {
  const openclawHealthy = await checkOpenClawHealth();
  
  res.json({
    status: openclawHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok',
      openclaw: openclawHealthy ? 'connected' : 'disconnected'
    }
  });
});
```

## BullMQ Job Queue

### Queue Configuration

```typescript
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

const taskQueue = new Queue('task-delegation', { connection });
```

### Job Processing Worker

```typescript
const worker = new Worker(
  'task-delegation',
  async (job) => {
    const { agentId, task } = job.data;
    
    console.log(`[Worker] Processing job ${job.id} for agent ${agentId}`);
    
    // Update agent status
    await db.update(agentTable)
      .set({ status: 'active' })
      .where(eq(agentTable.id, agentId));
    
    try {
      // Execute task via OpenClaw
      const result = await executeTaskOnOpenClaw(task);
      
      // Emit completion event
      io.emit('agent:task:completed', {
        agentId,
        jobId: job.id,
        result
      });
      
      return { success: true, result };
    } catch (error) {
      console.error(`[Worker] Task failed:`, error);
      throw error;
    } finally {
      // Reset agent status
      await db.update(agentTable)
        .set({ status: 'idle' })
        .where(eq(agentTable.id, agentId));
    }
  },
  { connection, concurrency: 5 }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});
```

### Job Priorities

```typescript
// High priority (urgent tasks)
await taskQueue.add('execute-task', data, { priority: 1 });

// Normal priority (default)
await taskQueue.add('execute-task', data, { priority: 5 });

// Low priority (background tasks)
await taskQueue.add('execute-task', data, { priority: 10 });
```

### Job Monitoring

```typescript
// GET /api/queue/stats
app.get('/api/queue/stats', async (req, res) => {
  const waiting = await taskQueue.getWaitingCount();
  const active = await taskQueue.getActiveCount();
  const completed = await taskQueue.getCompletedCount();
  const failed = await taskQueue.getFailedCount();
  
  res.json({ waiting, active, completed, failed });
});
```

## Dashboard Integration

### Real-time Updates

The dashboard uses a combination of polling and WebSocket for real-time updates:

```typescript
// Polling (TanStack Query)
const { data: agents } = useQuery({
  queryKey: ['agents'],
  queryFn: fetchAgents,
  refetchInterval: 5000 // Poll every 5 seconds
});

// WebSocket (Socket.IO)
useEffect(() => {
  const socket = io('http://localhost:3000');
  
  socket.on('agent:created', (agent) => {
    queryClient.invalidateQueries(['agents']);
  });
  
  return () => socket.disconnect();
}, []);
```

### Optimistic Updates

```typescript
// Update UI immediately, revert on error
const mutation = useMutation({
  mutationFn: createAgent,
  onMutate: async (newAgent) => {
    await queryClient.cancelQueries(['agents']);
    const previous = queryClient.getQueryData(['agents']);
    queryClient.setQueryData(['agents'], (old) => [...old, newAgent]);
    return { previous };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['agents'], context.previous);
  }
});
```

## Testing Guide

### Prerequisites

1. **Start OpenClaw**:
   ```bash
   openclaw serve --port 18789
   ```

2. **Start Redis**:
   ```bash
   docker run -p 6379:6379 redis:7-alpine
   ```

3. **Set Environment Variables**:
   ```bash
   export OPENCLAW_GATEWAY_TOKEN=your_token_here
   export DATABASE_URL=postgresql://...
   export REDIS_HOST=localhost
   export REDIS_PORT=6379
   ```

### Manual Testing

#### 1. Test OpenClaw Connection

```bash
# Test WebSocket gateway
wscat -c ws://localhost:18789 \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN"

# Test HTTP tools API
curl -X POST http://localhost:18789/tools/invoke \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool": "test", "parameters": {}}'
```

#### 2. Test Express API

```bash
# Health check
curl http://localhost:3000/health

# Create agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"teamId": "team-001", "type": "master"}'

# List agents
curl http://localhost:3000/api/agents

# Delegate task
curl -X POST http://localhost:3000/api/agents/agent-123/tasks \
  -H "Content-Type: application/json" \
  -d '{"task": "test task", "priority": 1}'
```

#### 3. Test BullMQ Queue

```bash
# Check queue stats
curl http://localhost:3000/api/queue/stats

# Monitor Redis keys
redis-cli keys "bull:task-delegation:*"
```

#### 4. Test Dashboard

1. Start dashboard: `cd packages/dashboard && npm run dev`
2. Open browser: `http://localhost:3001`
3. Verify:
   - Health status shows "ok" for API and OpenClaw
   - Agent metrics display correctly
   - WebSocket connection established
   - Real-time updates work when creating agents

### Automated Testing

```typescript
// tests/integration/openclaw.test.ts
import { describe, it, expect } from 'vitest';

describe('OpenClaw Integration', () => {
  it('should connect to gateway', async () => {
    const healthy = await checkOpenClawHealth();
    expect(healthy).toBe(true);
  });
  
  it('should execute tool via HTTP API', async () => {
    const result = await executeToolHTTP('test-tool', {});
    expect(result).toBeDefined();
  });
});

// tests/integration/api.test.ts
describe('Express API', () => {
  it('should create agent', async () => {
    const response = await request(app)
      .post('/api/agents')
      .send({ teamId: 'test', type: 'master' });
    
    expect(response.status).toBe(200);
    expect(response.body.agent).toHaveProperty('id');
  });
});
```

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  openclaw:
    image: composio/openclaw:latest
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
  
  api:
    build: ./packages/api
    ports:
      - "3000:3000"
    environment:
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - openclaw
      - redis
  
  dashboard:
    build: ./packages/dashboard
    ports:
      - "3001:3001"
    depends_on:
      - api

volumes:
  redis-data:
```

### Environment Variables

```bash
# .env.example
OPENCLAW_GATEWAY_TOKEN=your_secure_token_here
DATABASE_URL=postgresql://user:pass@localhost:5432/swarm_conductor
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=production
PORT=3000
```

### Production Checklist

- [ ] OpenClaw token is secure and rotated regularly
- [ ] Redis has persistence enabled
- [ ] Database migrations are up to date
- [ ] WebSocket connections have proper error handling
- [ ] Health checks are monitored (e.g., via Prometheus)
- [ ] Logs are centralized (e.g., CloudWatch, Datadog)
- [ ] CORS is properly configured for dashboard
- [ ] Rate limiting is enabled on API endpoints
- [ ] SSL/TLS is enabled for production WebSocket connections

## Troubleshooting

### OpenClaw Connection Issues

**Symptom**: Health check shows "disconnected"  
**Solutions**:
- Verify OpenClaw is running: `ps aux | grep openclaw`
- Check token: `echo $OPENCLAW_GATEWAY_TOKEN`
- Test connection: `wscat -c ws://localhost:18789`
- Review OpenClaw logs

### BullMQ Jobs Not Processing

**Symptom**: Jobs stuck in "waiting" state  
**Solutions**:
- Verify Redis is running: `redis-cli ping`
- Check worker is started: Look for "[Worker] started" log
- Inspect job: `redis-cli hgetall "bull:task-delegation:job-id"`
- Check for errors: `await taskQueue.getFailedCount()`

### Dashboard Not Updating

**Symptom**: Dashboard shows stale data  
**Solutions**:
- Check WebSocket connection in browser console
- Verify CORS headers: `curl -I http://localhost:3000/api/agents`
- Test polling: Open network tab and watch API calls
- Check Socket.IO logs on server

## License

**OpenClaw**: MIT License (Composio secure-openclaw fork)  
**Swarm Conductor**: MIT License

Both are permissive for commercial use.