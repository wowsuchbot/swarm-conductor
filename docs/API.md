# Swarm Conductor API Documentation

## Base URL

```
Development: http://localhost:3000/api/v1
Production: https://api.swarmconductor.com/api/v1
```

## Authentication

All endpoints except `/auth/*` require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Response Format

All responses follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

## Error Codes

- `AUTH_INVALID_CREDENTIALS` - Invalid email/password
- `AUTH_TOKEN_EXPIRED` - JWT token expired
- `AUTH_UNAUTHORIZED` - Missing or invalid token
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `VALIDATION_ERROR` - Request validation failed
- `BILLING_LIMIT_EXCEEDED` - Organization hit spending limit
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

---

## Authentication Endpoints

### Register User

```http
POST /auth/register
```

**Request Body:**
```typescript
{
  email: string;      // Valid email format
  password: string;   // Min 8 chars, 1 uppercase, 1 number
  name: string;       // Min 2 chars
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      createdAt: string;
    },
    token: string;      // JWT token
    refreshToken: string;
  }
}
```

**Status Codes:**
- `201` - User created successfully
- `400` - Validation error
- `409` - Email already exists

---

### Login

```http
POST /auth/login
```

**Request Body:**
```typescript
{
  email: string;
  password: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      organizations: Array<{
        id: string;
        name: string;
        role: 'owner' | 'admin' | 'member';
      }>;
    },
    token: string;
    refreshToken: string;
  }
}
```

**Status Codes:**
- `200` - Login successful
- `401` - Invalid credentials
- `429` - Rate limit exceeded (5 attempts per minute)

---

### Refresh Token

```http
POST /auth/refresh
```

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    token: string;
    refreshToken: string;
  }
}
```

**Status Codes:**
- `200` - Token refreshed
- `401` - Invalid refresh token

---

## Organization Endpoints

### Create Organization

```http
POST /organizations
```

**Request Body:**
```typescript
{
  name: string;           // Min 3 chars
  planTier: 'starter' | 'pro' | 'enterprise';
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    planTier: string;
    memberLimit: number;
    agentHourLimit: number;
    overflowEnabled: boolean;
    overflowCap: number | null;
    createdAt: string;
    members: [{
      userId: string;
      role: 'owner';
      joinedAt: string;
    }];
  }
}
```

**Status Codes:**
- `201` - Organization created
- `400` - Validation error
- `401` - Unauthorized

---

### Get Organization

```http
GET /organizations/:orgId
```

**Response:**
```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    planTier: string;
    memberLimit: number;
    agentHourLimit: number;
    overflowEnabled: boolean;
    overflowCap: number | null;
    currentMembers: number;
    currentAgentHours: number;  // This month
    estimatedCost: number;      // Current month
    createdAt: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
      role: 'owner' | 'admin' | 'member';
      joinedAt: string;
    }>;
    agents: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      createdAt: string;
    }>;
  }
}
```

**Status Codes:**
- `200` - Success
- `403` - Not a member of this organization
- `404` - Organization not found

---

### Update Organization

```http
PATCH /organizations/:orgId
```

**Request Body:**
```typescript
{
  name?: string;
  memberLimit?: number;        // Owner only
  overflowEnabled?: boolean;   // Owner/Admin only
  overflowCap?: number | null; // Owner/Admin only
}
```

**Response:**
```typescript
{
  success: true,
  data: OrganizationObject
}
```

**Status Codes:**
- `200` - Updated
- `403` - Insufficient permissions
- `404` - Not found

---

### Invite Member

```http
POST /organizations/:orgId/members
```

**Request Body:**
```typescript
{
  email: string;
  role: 'admin' | 'member';
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    inviteId: string;
    email: string;
    role: string;
    expiresAt: string;
  }
}
```

**Status Codes:**
- `201` - Invite sent
- `400` - Member limit exceeded
- `403` - Only owner/admin can invite
- `409` - User already a member

---

### Remove Member

```http
DELETE /organizations/:orgId/members/:userId
```

**Status Codes:**
- `204` - Member removed
- `403` - Insufficient permissions
- `400` - Cannot remove organization owner

---

## Agent Endpoints

### Create Agent

```http
POST /organizations/:orgId/agents
```

**Request Body:**
```typescript
{
  name: string;           // Min 3 chars
  type: 'master' | 'sub';
  parentAgentId?: string; // Required for type: 'sub'
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: string[];
    [key: string]: unknown;
  };
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    id: string;
    organizationId: string;
    name: string;
    type: string;
    status: 'spawning';  // Initial status
    parentAgentId: string | null;
    config: object;
    metadata: object;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Status Codes:**
- `201` - Agent spawn initiated
- `400` - Validation error or billing limit exceeded
- `403` - Unauthorized
- `404` - Organization not found

---

### List Agents

```http
GET /organizations/:orgId/agents
```

**Query Parameters:**
- `status` - Filter by status (idle, active, spawning, terminating, failed)
- `type` - Filter by type (master, sub)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)

**Response:**
```typescript
{
  success: true,
  data: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    parentAgentId: string | null;
    activeTasks: number;
    uptimeSeconds: number;
    lastHeartbeat: string | null;
    createdAt: string;
  }>,
  meta: {
    page: number;
    limit: number;
    total: number;
  }
}
```

**Status Codes:**
- `200` - Success
- `403` - Unauthorized

---

### Get Agent Details

```http
GET /organizations/:orgId/agents/:agentId
```

**Response:**
```typescript
{
  success: true,
  data: {
    id: string;
    organizationId: string;
    name: string;
    type: string;
    status: string;
    parentAgentId: string | null;
    config: object;
    metadata: object;
    stats: {
      totalTasks: number;
      completedTasks: number;
      failedTasks: number;
      avgTaskDuration: number;  // seconds
      totalComputeTime: number; // seconds
    };
    health: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      cpuPercent: number;
      memoryMb: number;
      lastError: string | null;
      lastHeartbeat: string;
    };
    subAgents?: Array<{  // If type: 'master'
      id: string;
      name: string;
      status: string;
    }>;
    createdAt: string;
    updatedAt: string;
  }
}
```

**Status Codes:**
- `200` - Success
- `403` - Unauthorized
- `404` - Agent not found

---

### Update Agent

```http
PATCH /organizations/:orgId/agents/:agentId
```

**Request Body:**
```typescript
{
  name?: string;
  config?: object;  // Merge with existing config
}
```

**Response:**
```typescript
{
  success: true,
  data: AgentObject
}
```

**Status Codes:**
- `200` - Updated
- `400` - Cannot update while agent is active
- `403` - Unauthorized
- `404` - Not found

---

### Execute Agent Task

```http
POST /organizations/:orgId/agents/:agentId/tasks
```

**Request Body:**
```typescript
{
  instruction: string;  // Natural language instruction
  priority?: number;    // 1-10, default: 5
  timeout?: number;     // Seconds, default: 300
  context?: object;     // Additional context data
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    taskId: string;
    status: 'queued';
    queuePosition: number;
    estimatedStartTime: string;
  }
}
```

**Status Codes:**
- `202` - Task queued
- `400` - Agent not active or validation error
- `403` - Unauthorized
- `429` - Rate limit exceeded

---

### Terminate Agent

```http
DELETE /organizations/:orgId/agents/:agentId
```

**Query Parameters:**
- `force` - Force immediate termination (default: false)

**Response:**
```typescript
{
  success: true,
  data: {
    id: string;
    status: 'terminating';
    estimatedTerminationTime: string;
  }
}
```

**Status Codes:**
- `202` - Termination initiated
- `403` - Unauthorized
- `404` - Agent not found

---

## Heartbeat Endpoints

### Get Agent Heartbeat History

```http
GET /organizations/:orgId/agents/:agentId/heartbeats
```

**Query Parameters:**
- `from` - Start timestamp (ISO 8601)
- `to` - End timestamp (ISO 8601)
- `limit` - Max results (default: 100, max: 1000)

**Response:**
```typescript
{
  success: true,
  data: Array<{
    id: string;
    agentId: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    cpuPercent: number;
    memoryMb: number;
    activeTasks: number;
    lastError: string | null;
    recordedAt: string;
  }>
}
```

**Status Codes:**
- `200` - Success
- `403` - Unauthorized

---

## Billing Endpoints

### Get Current Usage

```http
GET /organizations/:orgId/billing/usage
```

**Query Parameters:**
- `month` - YYYY-MM format (default: current month)

**Response:**
```typescript
{
  success: true,
  data: {
    period: {
      start: string;
      end: string;
    };
    plan: {
      tier: string;
      memberLimit: number;
      includedAgentHours: number;
      baseCost: number;
    };
    usage: {
      members: number;
      agentHours: number;
      overflowAgentHours: number;
    };
    costs: {
      base: number;
      additionalMembers: number;
      overflowUsage: number;
      total: number;
    };
    limits: {
      agentHourLimit: number;
      overflowCap: number | null;
      overflowEnabled: boolean;
      limitReached: boolean;
    };
  }
}
```

**Status Codes:**
- `200` - Success
- `403` - Unauthorized (owner/admin only)

---

### Get Usage Records

```http
GET /organizations/:orgId/billing/records
```

**Query Parameters:**
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)
- `type` - Filter by usage type (agent_hour, api_call, storage_gb)
- `page` - Page number
- `limit` - Results per page

**Response:**
```typescript
{
  success: true,
  data: Array<{
    id: string;
    agentId: string | null;
    agentName: string | null;
    usageType: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    recordedAt: string;
  }>,
  meta: {
    page: number;
    limit: number;
    total: number;
  }
}
```

**Status Codes:**
- `200` - Success
- `403` - Unauthorized

---

### Update Billing Settings

```http
PATCH /organizations/:orgId/billing/settings
```

**Request Body:**
```typescript
{
  overflowEnabled?: boolean;
  overflowCap?: number | null;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    overflowEnabled: boolean;
    overflowCap: number | null;
  }
}
```

**Status Codes:**
- `200` - Updated
- `403` - Unauthorized (owner only)

---

### Create Subscription

```http
POST /organizations/:orgId/billing/subscription
```

**Request Body:**
```typescript
{
  planTier: 'starter' | 'pro' | 'enterprise';
  paymentMethodId: string;  // Stripe payment method ID
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    subscriptionId: string;
    status: 'active';
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }
}
```

**Status Codes:**
- `201` - Subscription created
- `400` - Invalid payment method
- `403` - Unauthorized (owner only)

---

## Webhooks

### Stripe Webhook

```http
POST /webhooks/stripe
```

**Headers:**
- `Stripe-Signature` - Webhook signature for verification

**Handled Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Response:**
```typescript
{
  success: true
}
```

**Status Codes:**
- `200` - Webhook processed
- `400` - Invalid signature or payload

---

## WebSocket Events

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('https://api.swarmconductor.com', {
  auth: {
    token: 'jwt_token_here'
  }
});

// Subscribe to organization events
socket.emit('subscribe:org', { orgId: 'org_123' });
```

### Client -> Server Events

**subscribe:org**
```typescript
{
  orgId: string;
}
```

**unsubscribe:org**
```typescript
{
  orgId: string;
}
```

### Server -> Client Events

**agent:status_changed**
```typescript
{
  agentId: string;
  organizationId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}
```

**heartbeat:update**
```typescript
{
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpuPercent: number;
  memoryMb: number;
  activeTasks: number;
  timestamp: string;
}
```

**usage:alert**
```typescript
{
  organizationId: string;
  type: 'approaching_limit' | 'limit_reached' | 'overflow_warning';
  currentUsage: number;
  limit: number;
  message: string;
  timestamp: string;
}
```

**billing:event**
```typescript
{
  organizationId: string;
  eventType: string;
  amount: number;
  message: string;
  timestamp: string;
}
```

**task:completed**
```typescript
{
  taskId: string;
  agentId: string;
  status: 'success' | 'failed';
  result?: unknown;
  error?: string;
  duration: number;  // seconds
  timestamp: string;
}
```

---

## Rate Limits

- **Authentication**: 5 requests per minute per IP
- **API endpoints**: 100 requests per minute per user
- **Agent tasks**: 10 concurrent tasks per agent
- **WebSocket messages**: 50 messages per minute per connection

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` - Page number (starts at 1)
- `limit` - Items per page (max: 100)

**Response Meta:**
```typescript
{
  meta: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8
  }
}
```

---

## Filtering and Sorting

**Query Parameters:**
- `sort` - Sort field (e.g., `createdAt`, `-createdAt` for descending)
- `filter[field]` - Filter by field value

**Example:**
```
GET /organizations/:orgId/agents?sort=-createdAt&filter[status]=active&limit=10
```

---

## Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

### Organization
```typescript
interface Organization {
  id: string;
  name: string;
  planTier: 'starter' | 'pro' | 'enterprise';
  memberLimit: number;
  agentHourLimit: number;
  overflowEnabled: boolean;
  overflowCap: number | null;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Agent
```typescript
interface Agent {
  id: string;
  organizationId: string;
  name: string;
  type: 'master' | 'sub';
  status: 'idle' | 'active' | 'spawning' | 'terminating' | 'failed';
  parentAgentId: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

### Heartbeat
```typescript
interface Heartbeat {
  id: string;
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpuPercent: number;
  memoryMb: number;
  activeTasks: number;
  lastError: string | null;
  recordedAt: string;
}
```

### UsageRecord
```typescript
interface UsageRecord {
  id: string;
  organizationId: string;
  agentId: string | null;
  usageType: 'agent_hour' | 'api_call' | 'storage_gb';
  quantity: number;
  unitCost: number;
  totalCost: number;
  recordedAt: string;
}
```

---

## Example API Calls

### Complete Agent Lifecycle

```typescript
// 1. Login
const loginRes = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123'
  })
});
const { token } = await loginRes.json();

// 2. Create organization
const orgRes = await fetch('/api/v1/organizations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Team',
    planTier: 'pro'
  })
});
const { data: org } = await orgRes.json();

// 3. Create master agent
const agentRes = await fetch(`/api/v1/organizations/${org.id}/agents`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Research Agent',
    type: 'master',
    config: {
      model: 'gpt-4',
      temperature: 0.7
    }
  })
});
const { data: agent } = await agentRes.json();

// 4. Execute task
const taskRes = await fetch(
  `/api/v1/organizations/${org.id}/agents/${agent.id}/tasks`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instruction: 'Research latest AI developments',
      priority: 8
    })
  }
);
const { data: task } = await taskRes.json();

// 5. Monitor via WebSocket
const socket = io('https://api.swarmconductor.com', {
  auth: { token }
});

socket.emit('subscribe:org', { orgId: org.id });

socket.on('task:completed', (data) => {
  if (data.taskId === task.taskId) {
    console.log('Task completed:', data.result);
  }
});
```