export interface Agent {
  id: string;
  teamId: string;
  type: 'master' | 'sub';
  status: 'idle' | 'active' | 'terminated';
  sessionKey: string;
  parentAgentId?: string;
  createdAt: string;
  lastPing?: string;
}

export interface HealthData {
  status: string;
  timestamp: string;
  services: {
    api: string;
    openclaw: string;
  };
}