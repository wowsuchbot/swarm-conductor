# Dashboard — Component Structure & Event Schema

A chat-first PWA for managing parallel AI agents. Each agent gets a channel; you manage everything from a single adaptive UI.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** with custom dark theme tokens
- **Zustand** for client state (channels, messages, UI)
- **Socket.IO client** for real-time agent events
- **next-pwa** for service worker + offline shell

## Component Tree

```
Shell
├── Sidebar (desktop: always visible, mobile: slide-in drawer)
│   ├── [header: "SWARM" wordmark + compose button]
│   ├── ChannelList
│   │   └── ChannelRow × N (status pill + name + agent type + preview)
│   └── [footer: API connection indicator]
├── ChannelView (selected channel)
│   ├── [header: name, status badge, agent type, task preview]
│   ├── MessageFeed
│   │   └── MessageRow × N
│   │       ├── text → plain streamed text
│   │       ├── tool_call → ToolCallCard (collapsible: tool name, args, result, duration)
│   │       ├── artifact → ArtifactCard (code block, image, or file preview)
│   │       └── status → italic status line
│   └── ChatInput (pinned bottom, disabled when agent done/error)
├── MobileNav (mobile only, fixed bottom)
│   ├── Channels button → opens sidebar drawer
│   ├── + FAB → opens ComposeModal
│   └── Settings button
└── ComposeModal (overlay)
    ├── Task textarea
    ├── Agent type pill selector
    ├── Optional channel name input
    └── Spawn button → POST /agents → addChannel + subscribeToAgent
```

## State (Zustand — `src/lib/store.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `channels` | `AgentChannel[]` | All agent channels, newest first |
| `activeChannelId` | `string \| null` | Currently selected channel |
| `sidebarOpen` | `boolean` | Mobile drawer state |
| `composeOpen` | `boolean` | Compose modal state |

### AgentChannel

```ts
{
  id: string           // matches API agent ID
  name: string         // display name (user-set or auto-generated)
  task: string         // original task description
  agentType: string    // researcher | writer | coder | qa | planner | custom
  status: 'running' | 'waiting' | 'done' | 'error'
  messages: Message[]
  createdAt: number    // unix ms
  updatedAt: number    // unix ms
}
```

### Message

```ts
{
  id: string
  type: 'text' | 'tool_call' | 'artifact' | 'status'
  content?: string      // for text and status types
  toolCall?: {
    tool: string
    args: Record<string, unknown>
    result?: string
    duration?: number   // ms
  }
  artifact?: {
    type: 'code' | 'image' | 'file' | 'markdown'
    filename?: string
    language?: string
    content: string
    url?: string
  }
  timestamp: number     // unix ms
  agentId: string
}
```

## Socket.IO Events (`src/lib/socket.ts`)

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `agent:subscribe` | `{ agentId: string }` | Start receiving events for an agent |
| `agent:unsubscribe` | `{ agentId: string }` | Stop receiving events |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `agent:message` | `{ agentId: string, message: Message }` | New message from agent |
| `agent:status` | `{ agentId: string, status: AgentStatus }` | Agent status changed |

## REST API Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/agents` | Spawn a new agent → returns `{ id, ... }` |
| `PATCH` | `/agents/:id/message` | Send mid-task redirect message |
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:id` | Get agent details |

## Status Pills

| Status | Color | Behavior |
|--------|-------|----------|
| `running` | `#3fb950` (green) | Animated pulse dot |
| `waiting` | `#d29922` (amber) | Static dot |
| `done` | `#6e7681` (gray) | Static dot, input disabled |
| `error` | `#f85149` (red) | Static dot, input disabled |

## Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:3000   # Express API base URL
```

## Running Locally

```bash
cd packages/dashboard
pnpm install
pnpm dev        # → http://localhost:3001
```

Requires the Express API (`packages/api`) running on port 3000 and Redis + PostgreSQL via `docker-compose up -d`.