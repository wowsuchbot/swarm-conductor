'use client'

import { useSwarmStore, AgentChannel, AgentStatus } from '@/lib/store'
import { clsx } from 'clsx'

const STATUS_CONFIG: Record<AgentStatus, { label: string; dot: string; pulse: boolean }> = {
  running: { label: 'running', dot: 'bg-accent-green', pulse: true },
  waiting: { label: 'waiting', dot: 'bg-accent-amber', pulse: false },
  done:    { label: 'done',    dot: 'bg-gray-500',     pulse: false },
  error:   { label: 'error',   dot: 'bg-accent-red',   pulse: false },
}

function StatusPill({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      <span
        className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot, cfg.pulse && 'animate-pulse-dot')}
      />
    </span>
  )
}

function ChannelRow({ channel, active }: { channel: AgentChannel; active: boolean }) {
  const { setActiveChannel } = useSwarmStore()
  const lastMsg = channel.messages[channel.messages.length - 1]
  const preview = lastMsg?.content?.slice(0, 48) ?? channel.task.slice(0, 48)

  return (
    <button
      onClick={() => setActiveChannel(channel.id)}
      className={clsx(
        'w-full text-left px-3 py-2.5 rounded-md mx-2 transition-colors group',
        active ? 'bg-surface-3' : 'hover:bg-surface-2'
      )}
      style={{ width: 'calc(100% - 16px)' }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <StatusPill status={channel.status} />
        <span className={clsx('text-sm font-medium truncate', active ? 'text-white' : 'text-gray-300')}>
          {channel.name}
        </span>
        <span className="ml-auto text-[10px] text-gray-600 flex-shrink-0 font-mono">
          {channel.agentType}
        </span>
      </div>
      <p className="text-xs text-gray-500 truncate pl-3.5">{preview}</p>
    </button>
  )
}

export function ChannelList() {
  const { channels, activeChannelId, setComposeOpen } = useSwarmStore()

  if (channels.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-gray-600 mb-3">No agents yet</p>
        <button
          onClick={() => setComposeOpen(true)}
          className="text-xs text-accent-blue hover:underline"
        >
          Spawn your first agent
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-1">
      {channels.map((ch) => (
        <ChannelRow key={ch.id} channel={ch} active={ch.id === activeChannelId} />
      ))}
    </div>
  )
}