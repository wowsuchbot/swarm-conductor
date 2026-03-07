export type AgentStatus = 'running' | 'waiting' | 'done' | 'error'
export type MessageType = 'text' | 'tool_call' | 'artifact' | 'status'

export interface Agent {
  id: string
  name: string
  task: string
  agentType: string
  status: AgentStatus
  sessionKey?: string
  teamId?: string
  createdAt: string
  updatedAt: string
}
