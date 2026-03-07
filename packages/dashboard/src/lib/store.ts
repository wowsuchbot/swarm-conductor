import { create } from 'zustand'

export type AgentStatus = 'running' | 'waiting' | 'done' | 'error'

export type MessageType = 'text' | 'tool_call' | 'artifact' | 'status'

export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  result?: string
  duration?: number
}

export interface Artifact {
  type: 'code' | 'image' | 'file' | 'markdown'
  filename?: string
  language?: string
  content: string
  url?: string
}

export interface Message {
  id: string
  type: MessageType
  content?: string
  toolCall?: ToolCall
  artifact?: Artifact
  timestamp: number
  agentId: string
}

export interface AgentChannel {
  id: string
  name: string
  task: string
  agentType: string
  status: AgentStatus
  messages: Message[]
  createdAt: number
  updatedAt: number
}

interface SwarmStore {
  channels: AgentChannel[]
  activeChannelId: string | null
  sidebarOpen: boolean
  composeOpen: boolean
  setActiveChannel: (id: string) => void
  setSidebarOpen: (open: boolean) => void
  setComposeOpen: (open: boolean) => void
  addChannel: (channel: AgentChannel) => void
  updateChannelStatus: (id: string, status: AgentStatus) => void
  appendMessage: (channelId: string, message: Message) => void
}

export const useSwarmStore = create<SwarmStore>((set) => ({
  channels: [],
  activeChannelId: null,
  sidebarOpen: false,
  composeOpen: false,
  setActiveChannel: (id) => set({ activeChannelId: id, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setComposeOpen: (open) => set({ composeOpen: open }),
  addChannel: (channel) =>
    set((s) => ({
      channels: [channel, ...s.channels],
      activeChannelId: channel.id,
      sidebarOpen: false,
    })),
  updateChannelStatus: (id, status) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === id ? { ...c, status, updatedAt: Date.now() } : c
      ),
    })),
  appendMessage: (channelId, message) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId
          ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() }
          : c
      ),
    })),
}))
