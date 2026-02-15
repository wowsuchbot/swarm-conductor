# OpenClaw vs Swarm Conductor: Architectural Comparison

## Executive Summary

OpenClaw is a **personal AI assistant framework** - a single agent runtime that connects to messaging platforms (Telegram, Discord, Slack) and manages sessions, memory, and tool execution for one user.

Swarm Conductor is a **multi-agent orchestration platform** - a system for managing teams of agents with centralized control, billing, and monitoring for multiple users/organizations.

**Key Insight:** These are complementary, not competitive. OpenClaw agents could BE the worker agents in Swarm Conductor's fleet.

---

## Core Architectural Differences

| Aspect | OpenClaw | Swarm Conductor |
|--------|----------|------------------|
| **Scope** | Single-user agent runtime | Multi-tenant orchestration platform |
| **Agent Model** | One embedded pi-mono runtime | Master + sub-agent hierarchy |
| **Deployment** | Self-hosted personal assistant | Cloud service with billing/teams |
| **Memory** | File-based (MEMORY.md, daily logs) | Database-backed (PostgreSQL) |
| **Sessions** | JSONL transcripts per session | Session tracking + agent state in DB |
| **Messaging** | Direct integration (Telegram bot, etc.) | Mobile app + WebSocket coordination |
| **Multi-agent** | Routing between specialized contexts | True swarm with task delegation |
| **Billing** | N/A (self-hosted) | Stripe subscriptions + usage metering |

---

## What OpenClaw Does Well

### 1. Agent Runtime & Tool Execution
- **Embedded pi-mono runtime** with robust tool execution (read/write/exec)
- **Skills system** - reusable tool bundles loaded from workspace/bundled/managed locations
- **Context injection** - Bootstrap files (AGENTS.md, SOUL.md, USER.md) shape behavior
- **Session management** - Serialized runs per session with JSONL persistence
- **Compaction** - Automatic context summarization when approaching token limits

### 2. Memory Architecture
OpenClaw uses a **file-based memory hierarchy**:
```
MEMORY.md          ← Long-term strategic memory
active-context.md  ← Working memory (current projects/deadlines)
memory/YYYY-MM-DD.md ← Daily logs
```

This mirrors cognitive science principles:
- **Input gating** - Priority classification (P0-P3) determines what persists
- **Output gating** - Context-specific retrieval (only load relevant files)
- **Gating policies** - Rules learned from operational failures

### 3. Multi-Agent Routing
- **Presence system** - Agents can be online/offline/busy
- **Agent workspaces** - Isolated agents with separate auth/routing
- **Message routing** - Channel-based routing to specialized agents

### 4. Production-Ready Features
- **OAuth integration** - Built-in OAuth flows for external services
- **Webhook triggers** - External events can invoke agent actions
- **Cron scheduling** - Time-based automation
- **Plugin system** - Lifecycle hooks (before_agent_start, tool_result_persist, etc.)
- **Sandbox execution** - Isolated workspaces for non-main sessions

---

## What Swarm Conductor Needs to Add

### 1. Adopt OpenClaw's Memory Patterns
**Current proposal:** Simple PostgreSQL tables for agent state.

**Better approach (inspired by OpenClaw):**
- Hierarchical memory (strategic/operational/tactical)
- File-based working memory + database for structured data
- Gating policies that evolve from operational failures
- Context-aware retrieval (load only relevant memory for task type)

### 2. Consider OpenClaw Agents as Workers
Instead of building agent runtime from scratch, **use OpenClaw agents as the execution layer**:

```
Mobile App (Expo)
    ↓
Backend API (Node.js/Express)
    ↓
Master Coordinator
    ↓
OpenClaw Agent Fleet (via RPC)
    ↓
Tools/Skills/External APIs
```

**Benefits:**
- Proven agent runtime with tool execution, sessions, compaction
- Skills system for reusable capabilities
- OAuth/webhook integration already built
- Focus Swarm Conductor on orchestration, billing, monitoring

### 3. Extend OpenClaw's Multi-Agent System
OpenClaw has basic multi-agent routing. Swarm Conductor should add:
- **Task queues** - BullMQ for job distribution across agent pool
- **Agent lifecycle management** - Spawn/terminate based on workload
- **Team isolation** - Per-organization agent pools with resource limits
- **Billing integration** - Track agent compute time per team

### 4. Build What OpenClaw Lacks
Focus on the **platform layer** OpenClaw doesn't address:
- Multi-tenant architecture with team/org boundaries
- Usage-based billing with Stripe
- Mobile control interface (Expo app)
- Real-time monitoring dashboard (WebSocket + metrics)
- Agent health checks and auto-restart
- Cost controls (spending limits, overflow)

---

## Recommended Hybrid Architecture

### Layer 1: OpenClaw Agent Runtime (Execution)
- Use OpenClaw for individual agent instances
- Leverage skills, tools, sessions, compaction
- Each team gets isolated OpenClaw agent workspaces

### Layer 2: Swarm Conductor Orchestration (Coordination)
- Backend API manages teams, billing, authentication
- Master coordinator delegates tasks to OpenClaw agents via RPC
- BullMQ distributes work across agent pool
- PostgreSQL stores teams, members, billing, task history

### Layer 3: Mobile Interface (Control)
- Expo app provides dashboard and controls
- WebSocket for real-time agent status
- Task creation, team management, billing UI

### Integration Points
1. **RPC Communication:** Backend ↔ OpenClaw agents via gateway RPC
2. **Heartbeat Protocol:** Agents ping coordinator every 30s
3. **Task Queue:** BullMQ jobs invoke OpenClaw agent runs
4. **Memory Sync:** Agent workspaces backed up to S3/object storage

---

## Technology Stack Alignment

| Component | Swarm Conductor (Original) | OpenClaw | Recommendation |
|-----------|---------------------------|----------|----------------|
| Agent Runtime | Build from scratch | pi-mono embedded | **Use OpenClaw** |
| Backend API | Node.js/Express | N/A | **Keep Express** |
| Job Queue | BullMQ | Command queue | **BullMQ for orchestration** |
| Memory | PostgreSQL | File-based (MEMORY.md) | **Hybrid: Files + DB** |
| Sessions | Database | JSONL files | **Keep JSONL + DB metadata** |
| Tools | Custom | Skills system | **Use OpenClaw skills** |
| Monitoring | Prometheus/Grafana | Event streams | **Both** |

---

## Migration Path

### Phase 1: OpenClaw Integration Proof-of-Concept
1. Deploy single OpenClaw agent
2. Build Node.js service that invokes agent via RPC
3. Implement basic task queue (BullMQ → OpenClaw)
4. Validate heartbeat monitoring

### Phase 2: Multi-Agent Fleet
1. Deploy multiple OpenClaw agents with isolated workspaces
2. Implement master coordinator with task routing
3. Add agent lifecycle management (spawn/terminate)
4. Build monitoring dashboard

### Phase 3: Platform Features
1. Multi-tenant architecture (teams/orgs)
2. Stripe billing integration
3. Mobile app (Expo) with controls
4. Usage metering and cost controls

### Phase 4: Production Hardening
1. Agent auto-restart and health checks
2. Backup/restore for agent workspaces
3. Load balancing across agent pool
4. Security hardening (sandboxing, rate limits)

---

## Key Decisions

### ✅ Use OpenClaw for Agent Runtime
- Proven, production-ready agent execution
- Rich tool/skills ecosystem
- Session management and memory already solved
- Focus Swarm Conductor on orchestration layer

### ✅ Adopt OpenClaw's Memory Architecture
- File-based hierarchical memory (strategic/operational/tactical)
- Gating policies for learning from failures
- Context-aware retrieval
- Database for structured metadata only

### ✅ Build Platform Layer on Top
- Multi-tenancy, billing, mobile app are unique to Swarm Conductor
- These are the differentiators, not agent runtime
- Let OpenClaw evolve the agent capabilities

### ⚠️ Open Questions
1. **Licensing:** Is OpenClaw's license compatible with commercial use?
2. **RPC Scalability:** Can OpenClaw gateway handle fleet-scale RPC calls?
3. **Workspace Storage:** File-based memory at scale (1000s of agents)?
4. **Model Costs:** How to track/bill for model API usage per team?

---

## Next Steps

1. **Test OpenClaw RPC:** Build proof-of-concept Node.js service that invokes OpenClaw agent via gateway RPC
2. **Evaluate Licensing:** Review OpenClaw license for commercial compatibility
3. **Design Integration API:** Specify RPC protocol between Swarm Conductor and OpenClaw agents
4. **Update Architecture Docs:** Revise ARCHITECTURE.md to reflect hybrid approach
5. **Build PoC:** Single-agent system with Express + OpenClaw + BullMQ

---

## References

- [OpenClaw Agent Runtime](https://docs.openclaw.ai/concepts/agent)
- [OpenClaw Agent Loop](https://docs.openclaw.ai/concepts/agent-loop)
- [Multi-Agent Architecture Guide](https://www.getopenclaw.ai/help/multi-agent-architecture)
- [Building Cognitive Architecture for OpenClaw](https://shawnharris.com/building-a-cognitive-architecture-for-your-openclaw-agent/)
