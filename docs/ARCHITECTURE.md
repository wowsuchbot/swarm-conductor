# Swarm Conductor Architecture

## System Overview

Swarm Conductor is a distributed system for orchestrating AI agents from mobile devices. It uses a microservices architecture with clear separation between API, agent orchestration, and mobile client layers.

---

## Architectural Pivot: Hybrid OpenClaw Integration

**See [OPENCLAW-COMPARISON.md](../OPENCLAW-COMPARISON.md) for detailed analysis.**

After researching OpenClaw's architecture, we've adopted a hybrid approach that leverages OpenClaw's proven agent runtime rather than building from scratch:

### Three-Layer Architecture

**Layer 1: Agent Execution (OpenClaw)**
- OpenClaw provides the agent runtime, tool execution, and session management
- Each team gets isolated OpenClaw workspaces with file-based hierarchical memory
- Skills system handles reusable capabilities
- Built-in OAuth, webhooks, and compaction

**Layer 2: Orchestration (Swarm Conductor Backend)**
- Node.js/Express API manages teams, billing, and authentication
- Master coordinator delegates tasks to OpenClaw agents via gateway RPC
- BullMQ distributes work across agent pool
- PostgreSQL tracks teams, members, billing, task history

**Layer 3: Control Interface (Mobile App)**
- Expo React Native app provides dashboard and controls
- Real-time agent status via WebSocket
- Team management, task creation, billing UI

### Why This Approach

**Don't Rebuild What Exists:**
- OpenClaw has production-ready agent runtime with 2+ years of development
- Tools, sessions, memory, compaction already solved
- Active community and ecosystem

**Focus on Differentiation:**
- Multi-tenant architecture with team boundaries
- Usage-based billing and cost controls
- Mobile control interface
- Fleet orchestration and monitoring

**Faster Time to Market:**
- Skip agent runtime development (6+ months saved)
- Leverage OpenClaw's skills and tool ecosystem
- Focus engineering on platform features

---

## Core Principles

1. **100% Free Open Source Software** - No proprietary dependencies
2. **Mobile-First** - Optimized for mobile control and monitoring
3. **Real-Time by Default** - WebSocket-driven state updates
4. **Horizontally Scalable** - Stateless services with Redis-backed state
5. **Fail-Safe** - Circuit breakers, graceful degradation, health checks
6. **Cost-Aware** - Built-in usage tracking and spending controls

## Technology Stack Rationale

### Agent Runtime: OpenClaw (Python)

**Why OpenClaw:**
- Production-ready agent execution framework (2+ years development)
- Built-in tool system with OAuth, webhooks, and state management
- Hierarchical file-based memory with automatic compaction
- Skills system for reusable capabilities
- Active community and growing ecosystem
- Proven in production environments

**Integration Layer:**
- Gateway RPC for task delegation to OpenClaw instances
- Isolated workspaces per team (data isolation)
- Process pool for concurrent agent execution
- Shared disk or S3 for workspace persistence

### Orchestration Backend: Node.js 20 LTS

**Why Node.js for orchestration:**
- Non-blocking I/O ideal for WebSocket connections
- Single language (TypeScript) across backend and mobile
- Excellent ecosystem for real-time applications (Socket.io)
- Native async/await for API coordination
- Strong JSON handling for API responses
- BullMQ integration for distributed task queue

**Responsibilities:**
- Team/billing/auth management (not agent execution)
- Task routing to OpenClaw instances
- Real-time status updates via WebSocket
- Usage tracking and cost calculation

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
  status VARCHAR(50) NOT NULL, -- idle, busy, paused, stopped
  capabilities JSONB, -- array of capability strings
  current_task_id UUID,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_agents_status ON agents(status);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL, -- queued, running, completed, failed
  priority INTEGER DEFAULT 5,
  created_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_org ON tasks(organization_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_agent ON tasks(agent_id);

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  record_type VARCHAR(50) NOT NULL, -- agent_hour, api_call, storage_gb
  quantity DECIMAL(10,4) NOT NULL,
  cost DECIMAL(10,6), -- in USD
  metadata JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_org_date ON usage_records(organization_id, recorded_at);
```

### Cache/Queue: Redis 7

**Why Redis:**
- In-memory speed for real-time state synchronization
- Built-in pub/sub for WebSocket broadcasts
- BullMQ for distributed task queue
- Session storage for API authentication
- Rate limiting with sliding window

**Use Cases:**
- Agent state cache (idle/busy status)
- Task queue management
- WebSocket room management
- API rate limiting
- Session tokens

### Message Queue: BullMQ

**Why BullMQ over alternatives:**
- Redis-backed (reuses existing infrastructure)
- Priority queues for task urgency
- Delayed/scheduled jobs
- Concurrency control
- Built-in retry logic with exponential backoff
- Job progress tracking

### Frontend: Expo React Native

**Why React Native:**
- True native mobile apps from single codebase
- Hot reload for rapid development
- Expo simplifies build/deployment pipeline
- Large component ecosystem (React Native Paper)
- Native navigation with React Navigation
- Push notifications via Expo

**Alternatives Considered:**
- Flutter: Dart language barrier, smaller ecosystem
- Native (Swift/Kotlin): Double development effort
- PWA: Limited mobile capabilities, poor UX

### Real-Time Communication: Socket.io

**Why Socket.io:**
- Automatic fallback (WebSocket → polling)
- Built-in reconnection logic
- Room-based broadcasting
- TypeScript support
- Binary data support for future features

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Mobile App                          │
│                  (Expo React Native)                        │
│  - Team Dashboard                                           │
│  - Agent Control Panel                                      │
│  - Task Management                                          │
│  - Usage & Billing                                          │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             │ HTTPS/REST                 │ WebSocket
             │                            │
┌────────────▼────────────────────────────▼───────────────────┐
│              Swarm Conductor API Gateway                    │
│                    (Node.js/Express)                        │
│  - JWT Authentication                                       │
│  - Rate Limiting                                            │
│  - Multi-tenant Routing                                     │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             ├────────────────────────────┼──────────────────┐
             │                            │                  │
┌────────────▼────────┐      ┌───────────▼──────┐   ┌───────▼────────┐
│   Teams Service     │      │ Gateway Service  │   │ Billing Service│
│ - Org Management    │      │ - OpenClaw RPC   │   │ - Usage Tracking│
│ - Member Roles      │      │ - Task Routing   │   │ - Cost Calc    │
│ - Invites           │      │ - Workspace Mgmt │   │ - Stripe API   │
└─────────────────────┘      └──────────────────┘   └────────────────┘
             │                            │                  │
             └────────────────┬───────────┴──────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │    PostgreSQL 16   │
                    │  (Team/Billing DB) │
                    │  - Organizations   │
                    │  - Task History    │
                    │  - Usage Records   │
                    └────────────────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
┌────────────▼────┐   ┌───────▼──────┐  ┌─────▼──────────┐
│   Redis Cache   │   │  BullMQ Queue│  │ WebSocket Pool │
│ - Team State    │   │ - Task Queue │  │ - Socket.io    │
│ - Sessions      │   │ - Retry Logic│  │ - Status Push  │
└─────────────────┘   └──────┬───────┘  └────────────────┘
                             │
                ┌────────────▼────────────┐
                │    OpenClaw Agent Pool  │
                │  (Python - Isolated)    │
                │  ┌──────────────────┐   │
                │  │ Team A Workspace │   │
                │  │ - Master Agent   │   │
                │  │ - Sub Agents     │   │
                │  │ - Sessions       │   │
                │  │ - Memory         │   │
                │  └──────────────────┘   │
                │  ┌──────────────────┐   │
                │  │ Team B Workspace │   │
                │  │ - Master Agent   │   │
                │  │ - Sub Agents     │   │
                │  └──────────────────┘   │
                └─────────────────────────┘
                             │
                   ┌─────────▼─────────┐
                   │  Shared Storage   │
                   │ (S3 or EFS)       │
                   │ - Workspaces      │
                   │ - Agent Memories  │
                   │ - Session Data    │
                   └───────────────────┘
```

## Core Components

### 1. API Gateway (`packages/api`)

**Responsibilities:**
- HTTP request routing
- JWT token validation
- Rate limiting per organization
- Request/response transformation
- OpenAPI documentation
- Team-to-workspace mapping

**Tech Stack:**
- Express.js 4.18
- express-rate-limit
- helmet (security headers)
- cors
- zod (schema validation)

**Endpoints:**
```typescript
// Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

// Organizations
GET    /api/orgs
POST   /api/orgs
GET    /api/orgs/:orgId
PATCH  /api/orgs/:orgId
DELETE /api/orgs/:orgId

// Members
GET    /api/orgs/:orgId/members
POST   /api/orgs/:orgId/members/invite
DELETE /api/orgs/:orgId/members/:memberId

// Agents
GET    /api/orgs/:orgId/agents
POST   /api/orgs/:orgId/agents
GET    /api/agents/:agentId
PATCH  /api/agents/:agentId
DELETE /api/agents/:agentId
POST   /api/agents/:agentId/pause
POST   /api/agents/:agentId/resume

// Tasks
GET    /api/orgs/:orgId/tasks
POST   /api/orgs/:orgId/tasks
GET    /api/tasks/:taskId
PATCH  /api/tasks/:taskId
DELETE /api/tasks/:taskId

// Usage & Billing
GET    /api/orgs/:orgId/usage
GET    /api/orgs/:orgId/billing/current
POST   /api/orgs/:orgId/billing/payment-method
```

### 2. Teams Service (`packages/teams`)

**Responsibilities:**
- Organization CRUD
- Member management
- Role-based access control
- Invitation flow

**Database Tables:**
- organizations
- users
- organization_members
- invitations

### 3. OpenClaw Gateway Service (`packages/gateway`)

**Responsibilities:**
- OpenClaw workspace management per team
- Task delegation via RPC to OpenClaw agents
- Agent status streaming from OpenClaw instances
- Workspace isolation and resource limits
- Process pool coordination

**OpenClaw Integration:**
```typescript
import { OpenClawClient } from '@openclaw/client';

class OpenClawGateway {
  private workspaces: Map<string, OpenClawClient> = new Map();
  private processPool: OpenClawProcessPool;
  
  constructor() {
    this.processPool = new OpenClawProcessPool({
      minProcesses: 5,
      maxProcesses: 50,
      maxWorkspacesPerProcess: 3,
      memoryLimitPerWorkspace: '2GB'
    });
  }
  
  async getOrCreateWorkspace(orgId: string): Promise<OpenClawClient> {
    if (!this.workspaces.has(orgId)) {
      const client = await this.processPool.allocateWorkspace({
        workspaceId: orgId,
        workspaceDir: `/workspaces/${orgId}`,
        isolationLevel: 'strict',
        skillsPath: '/shared/skills',
        memoryConfig: {
          persistent: true,
          backend: 's3',
          bucketPath: `s3://swarm-workspaces/${orgId}`
        }
      });
      
      this.workspaces.set(orgId, client);
    }
    
    return this.workspaces.get(orgId);
  }
  
  async delegateTask(orgId: string, task: Task): Promise<TaskResult> {
    const workspace = await this.getOrCreateWorkspace(orgId);
    
    // Track start time for billing
    const startTime = Date.now();
    
    try {
      // Delegate to OpenClaw's master agent
      const result = await workspace.executeTask({
        agent: 'master',
        instruction: task.description,
        context: task.metadata,
        files: task.attachments,
        timeout: task.timeoutMs || 300000 // 5 min default
      });
      
      // Record usage
      const durationMs = Date.now() - startTime;
      await this.recordUsage(orgId, task.id, durationMs);
      
      return result;
    } catch (error) {
      // Still record usage even on failure
      const durationMs = Date.now() - startTime;
      await this.recordUsage(orgId, task.id, durationMs);
      throw error;
    }
  }
  
  async getAgentStatus(orgId: string): Promise<AgentStatus> {
    const workspace = await this.getOrCreateWorkspace(orgId);
    
    // Query OpenClaw for current agent states
    const agents = await workspace.listAgents();
    const sessions = await workspace.listSessions();
    
    return {
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.busy ? 'busy' : 'idle',
        currentTask: a.currentTask,
        capabilities: a.tools
      })),
      activeSessions: sessions.length,
      memoryUsage: await workspace.getMemoryStats()
    };
  }
  
  async pauseWorkspace(orgId: string): Promise<void> {
    const workspace = this.workspaces.get(orgId);
    if (workspace) {
      await workspace.pause();
      await this.processPool.releaseWorkspace(orgId);
      this.workspaces.delete(orgId);
    }
  }
  
  private async recordUsage(orgId: string, taskId: string, durationMs: number) {
    const hours = durationMs / (1000 * 60 * 60);
    
    await db.usageRecords.create({
      data: {
        organizationId: orgId,
        taskId,
        recordType: 'agent_hour',
        quantity: hours,
        recordedAt: new Date()
      }
    });
  }
}

// Export singleton
export const openClawGateway = new OpenClawGateway();
```

**State Sync:**
```typescript
// Subscribe to OpenClaw events
openClawGateway.on('agent:status_change', async (event) => {
  const { orgId, agentId, status, taskId } = event;
  
  // Update cache
  await redis.hset(`workspace:${orgId}:agent:${agentId}`, 'status', status);
  
  // Broadcast to WebSocket clients
  io.to(`org:${orgId}`).emit('agent:update', {
    agentId,
    status,
    taskId,
    timestamp: new Date().toISOString()
  });
});

openClawGateway.on('task:progress', async (event) => {
  const { orgId, taskId, progress, message } = event;
  
  // Broadcast real-time progress
  io.to(`org:${orgId}`).emit('task:progress', {
    taskId,
    progress,
    message,
    timestamp: new Date().toISOString()
  });
});
```

### 4. Billing Service (`packages/billing`)

**Responsibilities:**
- Usage tracking
- Cost calculation
- Stripe integration
- Limit enforcement

**Pricing Model:**
```typescript
const PRICING = {
  starter: {
    basePrice: 0,
    agentHourRate: 0,
    memberLimit: 5,
    agentHourLimit: 100
  },
  pro: {
    basePrice: 29.99,
    agentHourRate: 0.10,
    memberLimit: 20,
    agentHourLimit: 500
  },
  enterprise: {
    basePrice: 199.99,
    agentHourRate: 0.08,
    memberLimit: -1, // unlimited
    agentHourLimit: -1
  }
};

async function recordUsage(
  orgId: string,
  agentId: string,
  taskId: string,
  durationMs: number
) {
  const hours = durationMs / (1000 * 60 * 60);
  const org = await db.organizations.findUnique({ where: { id: orgId } });
  const rate = PRICING[org.planTier].agentHourRate;
  const cost = hours * rate;

  await db.usageRecords.create({
    data: {
      organizationId: orgId,
      agentId,
      taskId,
      recordType: 'agent_hour',
      quantity: hours,
      cost,
      recordedAt: new Date()
    }
  });

  // Check limits
  const monthlyUsage = await getMonthlyUsage(orgId);
  const limit = PRICING[org.planTier].agentHourLimit;

  if (limit > 0 && monthlyUsage.totalHours > limit) {
    if (!org.overflowEnabled) {
      await pauseAllAgents(orgId);
      await notifyLimitReached(orgId);
    }
  }
}
```

### 5. Task Queue (`packages/queue`)

**Responsibilities:**
- Task scheduling
- Priority management
- Retry logic
- Worker coordination

**BullMQ Configuration:**
```typescript
import { Queue, Worker, QueueScheduler } from 'bullmq';

const taskQueue = new Queue('tasks', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 1000
    }
  }
});

const worker = new Worker('tasks', async (job) => {
  const { taskId, orgId } = job.data;
  
  try {
    // Fetch task details
    const task = await db.tasks.findUnique({ where: { id: taskId } });
    
    // Delegate to OpenClaw workspace
    const result = await openClawGateway.delegateTask(orgId, task);
    
    // Record completion
    await db.tasks.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result
      }
    });
    
    return result;
  } catch (error) {
    // Record failure
    await db.tasks.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error: error.message
      }
    });
    
    throw error; // Trigger retry
  }
}, {
  connection: redis,
  concurrency: 10, // Max 10 parallel task delegations
  limiter: {
    max: 100, // Max 100 tasks per...
    duration: 60000 // ...60 seconds per org
  }
});
```

### 6. WebSocket Server (`packages/websocket`)

**Responsibilities:**
- Real-time state updates
- Bi-directional communication
- Room management
- Connection authentication

**Socket.io Setup:**
```typescript
import { Server } from 'socket.io';

const io = new Server(httpServer, {
  cors: {
    origin: process.env.MOBILE_APP_URL,
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = payload.userId;
    socket.data.orgId = payload.orgId;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const { orgId, userId } = socket.data;
  
  // Join organization room
  socket.join(`org:${orgId}`);
  
  // Subscribe to agent updates
  socket.on('subscribe:agents', () => {
    socket.join(`org:${orgId}:agents`);
  });
  
  // Subscribe to task updates
  socket.on('subscribe:tasks', () => {
    socket.join(`org:${orgId}:tasks`);
  });
  
  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
  });
});

// Broadcast helper
export function broadcastToOrg(orgId: string, event: string, data: any) {
  io.to(`org:${orgId}`).emit(event, data);
}
```

### 7. Mobile App (`packages/mobile`)

**Architecture:**
- React Navigation for screens
- Redux Toolkit for state management
- RTK Query for API calls
- Socket.io client for real-time updates
- React Native Paper for UI components

**Key Screens:**
```
App
├── Auth Stack
│   ├── Login
│   ├── Register
│   └── Forgot Password
└── Main Stack
    ├── Dashboard (Tab)
    │   ├── Agent Overview
    │   ├── Task Queue
    │   └── Usage Stats
    ├── Agents (Tab)
    │   ├── Agent List
    │   ├── Agent Detail
    │   └── Create Agent
    ├── Tasks (Tab)
    │   ├── Task List
    │   ├── Task Detail
    │   └── Create Task
    └── Settings (Tab)
        ├── Organization
        ├── Members
        ├── Billing
        └── Profile
```

**State Management:**
```typescript
// Redux slice for agents
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchAgents = createAsyncThunk(
  'agents/fetchAll',
  async (orgId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orgs/${orgId}/agents`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

const agentsSlice = createSlice({
  name: 'agents',
  initialState: {
    items: [],
    loading: false,
    error: null
  },
  reducers: {
    agentUpdated: (state, action) => {
      const index = state.items.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload };
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgents.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAgents.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

// Socket listener
socket.on('agent:update', (data) => {
  store.dispatch(agentsSlice.actions.agentUpdated(data));
});
```

## Deployment Architecture

### Development Environment

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: swarm_conductor
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Node.js orchestration layer
  api:
    build: ./packages/api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://dev:devpass@postgres:5432/swarm_conductor
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_secret
      OPENCLAW_GATEWAY_URL: http://openclaw-gateway:8000
    depends_on:
      - postgres
      - redis
      - openclaw-gateway

  websocket:
    build: ./packages/websocket
    ports:
      - "3001:3001"
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  # OpenClaw agent execution layer
  openclaw-gateway:
    build: 
      context: ./packages/openclaw-gateway
      dockerfile: Dockerfile.python
    ports:
      - "8000:8000"
    environment:
      WORKSPACE_BASE_PATH: /workspaces
      SKILLS_PATH: /shared/skills
      MAX_WORKSPACES: 10
      MEMORY_LIMIT_PER_WORKSPACE: 2GB
    volumes:
      - openclaw_workspaces:/workspaces
      - openclaw_skills:/shared/skills
    depends_on:
      - redis

volumes:
  postgres_data:
  openclaw_workspaces:
  openclaw_skills:
```

### Production Environment (AWS)

```
┌─────────────────────────────────────────────────────────┐
│                    Route 53 DNS                         │
│         api.swarmconductor.com                          │
│         ws.swarmconductor.com                           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Application Load Balancer                  │
│    - SSL Termination (ACM Certificate)                  │
│    - Path-based routing                                 │
│    - Health checks                                      │
└───────┬────────────────────────────┬────────────────────┘
        │                            │
┌───────▼──────────┐      ┌──────────▼────────┐
│   ECS Fargate    │      │   ECS Fargate     │
│ API/WS Service   │      │ OpenClaw Gateway  │
│ (Node.js)        │      │ (Python)          │
│ Auto-scaling     │      │ Auto-scaling      │
│ 2-10 tasks       │      │ 3-20 tasks        │
└───────┬──────────┘      └──────────┬────────┘
        │                            │
        └────────────┬───────────────┘
                     │
        ┌────────────▼─────────────┐
        │     RDS PostgreSQL       │
        │  Multi-AZ Deployment     │
        │  Automated Backups       │
        │  (Team/Billing Data)     │
        └──────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │  ElastiCache Redis       │
        │  Cluster Mode Enabled    │
        │  3 nodes, read replicas  │
        │  (Sessions/Task Queue)   │
        └──────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │         EFS              │
        │  (Shared Workspaces)     │
        │  - Team A Workspace      │
        │  - Team B Workspace      │
        │  - Shared Skills         │
        └──────────────────────────┘
```

**Infrastructure as Code (Terraform):**
```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "swarm-conductor-vpc"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier           = "swarm-conductor-db"
  engine              = "postgres"
  engine_version      = "16.1"
  instance_class      = "db.t4g.medium"
  allocated_storage   = 100
  storage_type        = "gp3"
  storage_encrypted   = true
  
  db_name  = "swarm_conductor"
  username = var.db_username
  password = var.db_password
  
  multi_az               = true
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "swarm-conductor-final-snapshot"
  
  tags = {
    Name = "swarm-conductor-postgres"
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "swarm-conductor-redis"
  replication_group_description = "Redis cluster for Swarm Conductor"
  
  engine               = "redis"
  engine_version       = "7.0"
  node_type           = "cache.t4g.medium"
  number_cache_clusters = 3
  
  parameter_group_name = "default.redis7"
  port                = 6379
  
  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  tags = {
    Name = "swarm-conductor-redis"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "swarm-conductor-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# API Service
resource "aws_ecs_task_definition" "api" {
  family                   = "swarm-conductor-api"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = "512"
  memory                  = "1024"
  
  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${var.ecr_repository}/api:latest"
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]
      
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.db_url.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/swarm-conductor-api"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "swarm-conductor-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"
  
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }
  
  depends_on = [aws_lb_listener.api]
}

# Auto Scaling
resource "aws_appautoscaling_target" "api" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "api-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

## Security Considerations

### Authentication & Authorization

**JWT Token Structure:**
```typescript
interface JWTPayload {
  userId: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member';
  iat: number;
  exp: number;
}

// Token expiry: 1 hour
// Refresh token expiry: 30 days
```

**Row-Level Security:**
```sql
-- Enable RLS on sensitive tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_org_isolation ON agents
  USING (organization_id = current_setting('app.current_org_id')::uuid);

-- Set org context on each request
SET app.current_org_id = '<org_id>';
```

### API Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: async (req) => {
    const org = await getOrganization(req.user.orgId);
    
    // Different limits per tier
    const limits = {
      starter: 100,
      pro: 500,
      enterprise: 2000
    };
    
    return limits[org.planTier];
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.orgId
});

app.use('/api/', limiter);
```

### Data Encryption

- **At Rest:** AES-256 for RDS and S3
- **In Transit:** TLS 1.3 for all API calls
- **Secrets:** AWS Secrets Manager
- **PII:** Field-level encryption for email/phone

## Monitoring & Observability

### Logging Stack

**Winston + CloudWatch:**
```typescript
import winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new CloudWatchTransport({
      logGroupName: '/swarm-conductor/api',
      logStreamName: () => {
        const date = new Date().toISOString().split('T')[0];
        return `${date}/${process.env.ECS_TASK_ID}`;
      },
      awsRegion: process.env.AWS_REGION
    })
  ]
});

// Structured logging
logger.info('Task assigned', {
  taskId: task.id,
  agentId: agent.id,
  orgId: org.id,
  duration: performance.now() - startTime
});
```

### Metrics (Prometheus + Grafana)

**Key Metrics:**
```typescript
import client from 'prom-client';

// Agent metrics
const agentStatusGauge = new client.Gauge({
  name: 'swarm_agents_by_status',
  help: 'Number of agents grouped by status',
  labelNames: ['org_id', 'status']
});

const taskDurationHistogram = new client.Histogram({
  name: 'swarm_task_duration_seconds',
  help: 'Task completion time in seconds',
  labelNames: ['org_id', 'agent_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
});

const apiRequestCounter = new client.Counter({
  name: 'swarm_api_requests_total',
  help: 'Total API requests',
  labelNames: ['method', 'path', 'status']
});

// Update metrics
agentStatusGauge.set({ org_id: orgId, status: 'idle' }, idleCount);
taskDurationHistogram.observe({ org_id: orgId, agent_type: 'master' }, duration);
apiRequestCounter.inc({ method: 'POST', path: '/api/tasks', status: '201' });
```

### Health Checks

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    queue: false
  };

  try {
    // Check database
    await db.$queryRaw`SELECT 1`;
    checks.database = true;

    // Check Redis
    await redis.ping();
    checks.redis = true;

    // Check queue
    const queueHealth = await taskQueue.getJobCounts();
    checks.queue = queueHealth !== undefined;

    const healthy = Object.values(checks).every(Boolean);

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      checks,
      error: error.message
    });
  }
});
```

### Alerting (PagerDuty Integration)

**Alert Rules:**
```yaml
# alerts.yml
groups:
  - name: swarm_conductor_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(swarm_api_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High API error rate"
          
      - alert: DatabaseConnectionFailure
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
          
      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
          
      - alert: TaskQueueBacklog
        expr: bullmq_queue_waiting_jobs > 1000
        for: 10m
        labels:
          severity: warning
          
      - alert: HighCPUUsage
        expr: container_cpu_usage_percent > 80
        for: 5m
        labels:
          severity: warning
```

## Performance Optimization

### Database Query Optimization

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_tasks_org_status_created ON tasks(organization_id, status, created_at DESC);
CREATE INDEX idx_usage_org_date ON usage_records(organization_id, recorded_at DESC);

-- Partition large tables
CREATE TABLE usage_records_2024_01 PARTITION OF usage_records
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Materialized views for dashboard queries
CREATE MATERIALIZED VIEW org_usage_summary AS
SELECT 
  organization_id,
  DATE_TRUNC('day', recorded_at) as date,
  SUM(quantity) as total_hours,
  SUM(cost) as total_cost
FROM usage_records
WHERE record_type = 'agent_hour'
GROUP BY organization_id, date;

CREATE UNIQUE INDEX ON org_usage_summary(organization_id, date);

-- Refresh hourly
REFRESH MATERIALIZED VIEW CONCURRENTLY org_usage_summary;
```

### Redis Caching Strategy

```typescript
// Cache frequently accessed data
const CACHE_TTL = {
  agent_status: 60, // 1 minute
  org_settings: 300, // 5 minutes
  user_profile: 600 // 10 minutes
};

async function getAgentStatus(agentId: string): Promise<AgentStatus> {
  const cacheKey = `agent:${agentId}:status`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const agent = await db.agents.findUnique({
    where: { id: agentId },
    select: { status, currentTaskId, lastActive }
  });
  
  // Cache result
  await redis.setex(
    cacheKey,
    CACHE_TTL.agent_status,
    JSON.stringify(agent)
  );
  
  return agent;
}
```

### Connection Pooling

```typescript
// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Redis connection pool
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  enableReadyCheck: true
});
```

## Testing Strategy

### Unit Tests (Jest + Supertest)

```typescript
// packages/api/tests/agents.test.ts
describe('Agents API', () => {
  let app: Express;
  let db: PrismaClient;
  
  beforeAll(async () => {
    db = new PrismaClient();
    app = createApp(db);
  });
  
  afterAll(async () => {
    await db.$disconnect();
  });
  
  describe('POST /api/orgs/:orgId/agents', () => {
    it('should create a new agent', async () => {
      const response = await request(app)
        .post('/api/orgs/test-org-id/agents')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Agent',
          type: 'sub',
          capabilities: ['web-search', 'code-execution']
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Test Agent',
        type: 'sub',
        status: 'idle'
      });
    });
    
    it('should reject invalid capabilities', async () => {
      const response = await request(app)
        .post('/api/orgs/test-org-id/agents')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Agent',
          type: 'sub',
          capabilities: ['invalid-capability']
        });
      
      expect(response.status).toBe(400);
    });
  });
});
```

### Integration Tests

```typescript
// Test full task workflow
describe('Task Execution Flow', () => {
  it('should assign task to agent and complete', async () => {
    // Create agent
    const agent = await createTestAgent();
    
    // Create task
    const task = await createTask({
      title: 'Test Task',
      organizationId: testOrgId
    });
    
    // Assign task
    await assignTask(task.id);
    
    // Check agent status
    const agentStatus = await getAgentStatus(agent.id);
    expect(agentStatus.status).toBe('busy');
    
    // Complete task
    await completeTask(task.id, { result: 'success' });
    
    // Check final states
    const finalTask = await getTask(task.id);
    const finalAgent = await getAgentStatus(agent.id);
    
    expect(finalTask.status).toBe('completed');
    expect(finalAgent.status).toBe('idle');
  });
});
```

### E2E Tests (Detox for Mobile)

```typescript
// packages/mobile/e2e/dashboard.test.ts
describe('Dashboard', () => {
  beforeAll(async () => {
    await device.launchApp();
    await loginAsTestUser();
  });
  
  it('should show agent list', async () => {
    await expect(element(by.id('agent-list'))).toBeVisible();
    await expect(element(by.text('Master Coordinator'))).toBeVisible();
  });
  
  it('should create new task', async () => {
    await element(by.id('new-task-button')).tap();
    await element(by.id('task-title-input')).typeText('Test Task');
    await element(by.id('task-description-input')).typeText('Description');
    await element(by.id('submit-task-button')).tap();
    
    await expect(element(by.text('Test Task'))).toBeVisible();
  });
});
```

## Future Enhancements

### Phase 2: Advanced Features

1. **Voice Control** - Integrate with device speech recognition
2. **Offline Mode** - Queue tasks when device is offline
3. **Team Chat** - Built-in messaging for team coordination
4. **Agent Marketplace** - Pre-built agent templates
5. **Workflow Builder** - Visual task chaining interface

### Phase 3: Enterprise Features

1. **SSO Integration** - SAML/OAuth for enterprise auth
2. **Audit Logs** - Comprehensive activity tracking
3. **Custom Roles** - Granular permission system
4. **Multi-Region** - Deploy agents in specific AWS regions
5. **Compliance** - SOC2, GDPR, HIPAA certifications

---

**Last Updated:** February 2024
**Version:** 1.0.0
**Maintainer:** Swarm Conductor Team
