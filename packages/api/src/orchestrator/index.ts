import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import { OpenClawClient } from '../openclaw/client.js';

export interface Agent {
  id: string;
  teamId: string;
  type: 'master' | 'sub';
  status: 'idle' | 'active' | 'terminated';
  sessionKey: string;
  parentAgentId?: string;
  createdAt: Date;
  lastPing?: Date;
}

export class AgentOrchestrator extends EventEmitter {
  private agents = new Map<string, Agent>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private openClawClient: OpenClawClient,
    private io: SocketIOServer
  ) {
    super();
    
    // Listen to OpenClaw events
    this.openClawClient.on('event', (event) => {
      this.handleOpenClawEvent(event);
    });
  }

  async start(): Promise<void> {
    console.log('[Orchestrator] Starting...');
    
    // Start heartbeat monitoring
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000); // Every 30 seconds
    
    console.log('[Orchestrator] Started');
  }

  async stop(): Promise<void> {
    console.log('[Orchestrator] Stopping...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    console.log('[Orchestrator] Stopped');
  }

  async createAgent(config: Partial<Agent>): Promise<Agent> {
    const agent: Agent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      teamId: config.teamId || 'default',
      type: config.type || 'sub',
      status: 'idle',
      sessionKey: config.sessionKey || `session-${Date.now()}`,
      parentAgentId: config.parentAgentId,
      createdAt: new Date()
    };

    this.agents.set(agent.id, agent);
    
    // Emit to WebSocket clients
    this.io.to(`team:${agent.teamId}`).emit('agent:created', agent);
    
    console.log(`[Orchestrator] Created agent: ${agent.id}`);
    return agent;
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async listAgents(teamId?: string): Promise<Agent[]> {
    const agents = Array.from(this.agents.values());
    return teamId
      ? agents.filter(a => a.teamId === teamId)
      : agents;
  }

  async delegateTask(agentId: string, task: string): Promise<any> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.status = 'active';
    agent.lastPing = new Date();
    
    // Send task to OpenClaw
    const result = await this.openClawClient.sendAgentMessage(task, agent.sessionKey);
    
    // Emit to WebSocket clients
    this.io.to(`agent:${agentId}`).emit('agent:task:completed', {
      agentId,
      task,
      result
    });
    
    agent.status = 'idle';
    return result;
  }

  private handleOpenClawEvent(event: any): void {
    // Forward OpenClaw events to WebSocket clients
    this.io.emit('openclaw:event', event);
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 90000; // 90 seconds

    for (const [id, agent] of this.agents.entries()) {
      if (agent.lastPing && now - agent.lastPing.getTime() > timeout) {
        console.warn(`[Orchestrator] Agent ${id} heartbeat timeout`);
        agent.status = 'terminated';
        this.io.to(`agent:${id}`).emit('agent:heartbeat:timeout', { agentId: id });
      }
    }
  }
}
