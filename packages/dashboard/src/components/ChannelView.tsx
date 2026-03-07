'use client'

import { useEffect, useRef } from 'react'
import { AgentChannel } from '@/lib/store'
import { subscribeToAgent, unsubscribeFromAgent } from '@/lib/socket'
import { MessageFeed } from './MessageFeed'
import { ChatInput } from './ChatInput'
import { useSwarmStore } from '@/lib/store'
import { clsx } from 'clsx'

const STATUS_LABELS = {
  running: { text: 'Running', cls: 'text-accent-green' },
  waiting: { text: 'Waiting', cls: 'text-accent-amber' },
  done:    { text: 'Done',    cls: 'text-gray-500' },
  error:   { text: 'Error',   cls: 'text-accent-red' },
}

export function ChannelView({ channel }: { channel: AgentChannel }) {
  const { setSidebarOpen } = useSwarmStore()

  useEffect(() => {
    subscribeToAgent(channel.id)
    return () => unsubscribeFromAgent(channel.id)
  }, [channel.id])

  const cfg = STATUS_LABELS[channel.status]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Channel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0 bg-surface-1">
        {/* Mobile menu button */}
        <button
          className="md:hidden text-gray-400 hover:text-white mr-1"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-white truncate">{channel.name}</h1>
            <span className={clsx('text-xs font-medium flex-shrink-0', cfg.cls)}>{cfg.text}</span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{channel.task}</p>
        </div>
        <span className="text-xs text-gray-600 font-mono flex-shrink-0 bg-surface-2 px-2 py-0.5 rounded">
          {channel.agentType}
        </span>
      </div>

      {/* Messages */}
      <MessageFeed channel={channel} />

      {/* Input */}
      <ChatInput channelId={channel.id} disabled={channel.status === 'done' || channel.status === 'error'} />
    </div>
  )
}