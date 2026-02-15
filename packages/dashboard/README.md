# Swarm Conductor Dashboard

Real-time monitoring dashboard for the Swarm Conductor agent orchestration system.

## Features

- **Real-time Agent Monitoring**: View all active, idle, and terminated agents
- **System Health**: Monitor API and OpenClaw connection status
- **Live Metrics**: Track agent counts and status distribution
- **WebSocket Updates**: Automatic updates when agents are created or tasks complete
- **Interactive Agent Selection**: Click agents to subscribe to detailed updates

## Quick Start

### Prerequisites

- Node.js 18+
- Running Swarm Conductor API (port 3000)
- OpenClaw instance (port 18789)

### Installation

```bash
cd packages/dashboard
npm install
```

### Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3001`

### Build for Production

```bash
npm run build
npm run preview
```

## Architecture

### Components

- **App.tsx**: Main application component with WebSocket connection management
- **HealthStatus.tsx**: System health indicator for API and OpenClaw services
- **RealtimeMetrics.tsx**: Agent statistics (total, active, idle, terminated)
- **AgentList.tsx**: Interactive table of all agents with real-time selection

### API Integration

- **Polling**: Health checks every 3s, agent list every 5s
- **WebSocket Events**:
  - `agent:created` - New agent created
  - `agent:task:completed` - Task finished
  - `openclaw:event` - OpenClaw system events
  - `subscribe:agent` - Subscribe to specific agent updates

### Tech Stack

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **TanStack Query**: Data fetching and caching
- **Socket.IO Client**: Real-time WebSocket communication
- **Axios**: HTTP client
- **TypeScript**: Type safety

## Configuration

The dashboard connects to the API at `http://localhost:3000` by default. Update `src/api.ts` and `vite.config.ts` to change the backend URL.

## Development Notes

- The dashboard uses Vite's proxy to forward `/api` and `/health` requests to the backend
- WebSocket connections are established on component mount and cleaned up on unmount
- Agent list refetches automatically when WebSocket events are received
- Click any agent row to subscribe to detailed updates for that agent

## Color Coding

- **Green (#10b981)**: Healthy/Active
- **Blue (#3b82f6)**: Idle
- **Red (#ef4444)**: Terminated/Disconnected
- **Orange (#f59e0b)**: Warning/Disconnected
- **Purple (#7c3aed)**: Master agents
- **Gray (#334155)**: Sub-agents

## Troubleshooting

### Dashboard shows "No agents running"
- Ensure the API is running on port 3000
- Check that OpenClaw is accessible
- Create a test agent via the API: `POST http://localhost:3000/api/agents`

### WebSocket not connecting
- Verify the API is running and accessible
- Check browser console for connection errors
- Ensure CORS is configured correctly on the API

### Health check shows disconnected
- Verify OpenClaw is running on port 18789
- Check `OPENCLAW_GATEWAY_TOKEN` environment variable
- Review API logs for connection errors