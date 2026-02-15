import { Socket } from 'socket.io-client';
import { Agent } from '../types';
import { useState } from 'react';

interface Props {
  agents: Agent[];
  socket: Socket | null;
}

export default function AgentList({ agents, socket }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const subscribeToAgent = (agentId: string) => {
    if (socket) {
      socket.emit('subscribe:agent', agentId);
      setSelectedAgent(agentId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'idle': return '#3b82f6';
      case 'terminated': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="card agent-list">
      <div className="card-header">
        <h2>Agents</h2>
        <span className="agent-count">{agents.length} total</span>
      </div>
      
      {agents.length === 0 ? (
        <p className="empty-state">No agents running. Create one to get started.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Team</th>
                <th>Session</th>
                <th>Created</th>
                <th>Last Ping</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr 
                  key={agent.id}
                  className={selectedAgent === agent.id ? 'selected' : ''}
                  onClick={() => subscribeToAgent(agent.id)}
                >
                  <td className="agent-id">{agent.id}</td>
                  <td>
                    <span className={`badge badge-${agent.type}`}>
                      {agent.type}
                    </span>
                  </td>
                  <td>
                    <span 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(agent.status) }}
                    >
                      {agent.status}
                    </span>
                  </td>
                  <td>{agent.teamId}</td>
                  <td className="session-key">{agent.sessionKey}</td>
                  <td>{new Date(agent.createdAt).toLocaleString()}</td>
                  <td>
                    {agent.lastPing 
                      ? new Date(agent.lastPing).toLocaleTimeString()
                      : '—'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}