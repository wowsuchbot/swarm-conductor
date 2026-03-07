'use client'

import { useState } from 'react'
import { useSwarmStore, AgentChannel } from '@/lib/store'
import { subscribeToAgent } from '@/lib/socket'

const AGENT_TYPES = ['researcher', 'writer', 'coder', 'qa', 'planner', 'custom']

export function ComposeModal() {
  const { setComposeOpen, addChannel } = useSwarmStore()
  const [task, setTask] = useState('')
  const [agentType, setAgentType] = useState('researcher')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!task.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, agentType, name: name || undefined }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const agent = await res.json()

      const channel: AgentChannel = {
        id: agent.id,
        name: name || `${agentType}-${agent.id.slice(0, 6)}`,
        task,
        agentType,
        status: 'running',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      addChannel(channel)
      subscribeToAgent(agent.id)
      setComposeOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spawn agent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setComposeOpen(false)} />
      <div className="relative w-full max-w-md bg-surface-1 border border-border rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">New Agent</h2>
          <button
            onClick={() => setComposeOpen(false)}
            className="text-gray-500 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Task</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what this agent should do..."
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue resize-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Agent Type</label>
            <div className="flex flex-wrap gap-2">
              {AGENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAgentType(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    agentType === t
                      ? 'bg-accent-blue text-surface'
                      : 'bg-surface-2 text-gray-400 hover:text-white border border-border'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Channel Name <span className="text-gray-600">(optional)</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${agentType}-xxxxxx`}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-blue"
            />
          </div>

          {error && <p className="text-xs text-accent-red">{error}</p>}

          <button
            type="submit"
            disabled={loading || !task.trim()}
            className="w-full py-2.5 bg-accent-blue text-surface font-semibold text-sm rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Spawning...' : 'Spawn Agent'}
          </button>
        </form>
      </div>
    </div>
  )
}