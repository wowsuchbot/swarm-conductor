# Swarm Conductor

> Distributed agent orchestration system with mobile control - OpenClaw agents, master heartbeat, and team-based billing

## Overview

Swarm Conductor is a production-ready platform for orchestrating distributed AI agents from a mobile application. Built with 100% free and open-source software, it provides team management, usage-based billing, and real-time health monitoring.

**Key Features:**
- 📱 Mobile-first control via Expo React Native app
- 🤖 OpenClaw agent integration with hierarchical command structure
- 💓 Master heartbeat system for health monitoring
- 👥 Team-based access control with flexible pricing tiers
- 💰 Usage tracking with overflow spending controls
- 🔄 Real-time agent status via WebSocket
- 🐳 Fully containerized deployment

## Architecture

### Technology Stack (All FOSS)

**Backend:**
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js (API server)
- **Language:** TypeScript
- **Database:** PostgreSQL 16 (relational data)
- **Cache/Queue:** Redis 7 (agent state, job queues)
- **Job Processing:** BullMQ (reliable task queues)
- **WebSocket:** Socket.io (real-time updates)
- **Authentication:** JWT tokens with bcrypt
- **Validation:** Zod (runtime type safety)
- **ORM:** Drizzle ORM (type-safe SQL)

**Mobile App:**
- **Framework:** Expo (React Native)
- **Language:** TypeScript
- **State Management:** Zustand (local), TanStack Query (server)
- **Navigation:** React Navigation
- **WebSocket Client:** Socket.io-client
- **Forms:** React Hook Form + Zod validation
- **UI Components:** React Native Paper

**Agent System:**
- **Agent Framework:** OpenClaw (autonomous agents)
- **Message Queue:** BullMQ with Redis backend
- **Process Management:** PM2 (agent lifecycle)
- **Monitoring:** Custom heartbeat service

**Infrastructure:**
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Caddy (automatic HTTPS)
- **Monitoring:** Prometheus + Grafana
- **Logging:** Winston + Loki
- **CI/CD:** GitHub Actions

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                        │
│  Dashboard | Teams | Agents | Billing | Monitoring          │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API + WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│              API Server (Express + Socket.io)               │
│  Auth | Teams | Billing | Agent Control | Metrics           │
└─────┬───────────────┬───────────────────┬───────────────────┘
      │               │                   │
┌─────▼─────┐  ┌──────▼──────┐  ┌─────────▼─────────┐
│ PostgreSQL │  │    Redis    │  │  Stripe Webhooks  │
│  (Teams,   │  │ (Sessions,  │  │  (Billing Events) │
│   Users,   │  │  Queues)    │  │                   │
│  Billing)  │  └──────┬──────┘  └───────────────────┘
└───────────┘         │
                 ┌────▼─────┐
                 │  BullMQ  │
                 │ (Job     │
                 │  Queue)  │
                 └────┬─────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │ Master  │   │  Sub   │   │  Sub   │
   │ Agent   │───┤ Agent  │   │ Agent  │
   │         │   │   1    │   │   2    │
   └────┬────┘   └────────┘   └────────┘
        │
   ┌────▼────────────┐
   │ Heartbeat       │
   │ Monitor Service │
   └─────────────────┘
```

## Project Structure

```
swarm-conductor/
├── packages/
│   ├── api/                 # Express API server
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/  # Auth, validation
│   │   │   ├── websocket/   # Socket.io handlers
│   │   │   └── db/          # Database schema & migrations
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── agents/              # Agent orchestration system
│   │   ├── src/
│   │   │   ├── master/      # Master agent coordinator
│   │   │   ├── worker/      # Sub-agent workers
│   │   │   ├── heartbeat/   # Health monitoring
│   │   │   └── openclaw/    # OpenClaw integration
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── mobile/              # Expo React Native app
│   │   ├── src/
│   │   │   ├── screens/     # App screens
│   │   │   ├── components/  # Reusable components
│   │   │   ├── api/         # API client & hooks
│   │   │   ├── store/       # Zustand stores
│   │   │   └── navigation/  # React Navigation setup
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── shared/              # Shared TypeScript types
│       ├── src/
│       │   ├── types/       # Common interfaces
│       │   └── schemas/     # Zod validation schemas
│       └── package.json
│
├── infrastructure/
│   ├── docker-compose.yml   # Local development stack
│   ├── docker-compose.prod.yml
│   ├── caddy/               # Reverse proxy config
│   ├── prometheus/          # Monitoring config
│   └── grafana/             # Dashboard definitions
│
├── docs/
│   ├── ARCHITECTURE.md      # Detailed system design
│   ├── API.md               # API documentation
│   ├── DEPLOYMENT.md        # Deployment guide
│   └── DEVELOPMENT.md       # Development setup
│
├── .github/
│   └── workflows/
│       ├── api-ci.yml       # Backend CI/CD
│       ├── mobile-ci.yml    # Mobile app CI/CD
│       └── agents-ci.yml    # Agent system CI/CD
│
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- pnpm (package manager)
- Expo CLI (for mobile development)

### Development Setup

```bash
# Clone repository
git clone https://github.com/wowsuchbot/swarm-conductor.git
cd swarm-conductor

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis)
docker-compose up -d

# Run database migrations
pnpm --filter @swarm/api db:migrate

# Start API server
pnpm --filter @swarm/api dev

# Start agent system (separate terminal)
pnpm --filter @swarm/agents dev

# Start mobile app (separate terminal)
pnpm --filter @swarm/mobile start
```

## Core Concepts

### Agent Hierarchy

1. **Master Agent** - One per team, receives commands from API
2. **Sub-Agents** - Spawned by master for specialized tasks
3. **Heartbeat Service** - Independent monitor tracking all agents

### Team & Billing Model

- Teams have a base plan with included teammates and agent hours
- Additional teammates charged per-seat pricing
- Agent usage metered by compute time
- Overflow spending can be enabled/disabled
- Hard spending caps prevent runaway costs

### Real-Time Communication

- WebSocket connection per mobile client
- Events: agent_status_changed, heartbeat_update, usage_alert
- Automatic reconnection with exponential backoff
- Event replay on reconnect (missed updates)

## Development Roadmap

**Phase 1: Foundation** (Weeks 1-3)
- [x] Repository setup
- [ ] Database schema & migrations
- [ ] API server skeleton with auth
- [ ] Basic team CRUD operations
- [ ] Docker Compose development environment

**Phase 2: Agent System** (Weeks 3-5)
- [ ] Master agent coordinator
- [ ] Sub-agent spawning logic
- [ ] BullMQ job queue integration
- [ ] Heartbeat monitoring service
- [ ] Agent lifecycle management

**Phase 3: Billing** (Weeks 4-6)
- [ ] Stripe integration
- [ ] Usage tracking & metering
- [ ] Subscription management
- [ ] Webhook handlers
- [ ] Spending limit enforcement

**Phase 4: Mobile App** (Weeks 5-8)
- [ ] Expo project setup
- [ ] Authentication flow
- [ ] Dashboard with agent status
- [ ] Team management screens
- [ ] Billing & usage display
- [ ] Real-time updates via WebSocket

**Phase 5: Production Ready** (Weeks 7-9)
- [ ] Comprehensive testing
- [ ] Monitoring & alerting setup
- [ ] Production deployment configs
- [ ] CI/CD pipelines
- [ ] Documentation & guides

## Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues, please open a GitHub issue.

---

Built with ❤️ using 100% free and open-source software