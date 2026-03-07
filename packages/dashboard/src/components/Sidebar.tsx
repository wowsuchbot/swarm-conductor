'use client'

import { useSwarmStore } from '@/lib/store'
import { ChannelList } from './ChannelList'

export function Sidebar() {
  const { setComposeOpen } = useSwarmStore()

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-accent-blue font-bold text-sm tracking-wider uppercase">Swarm</span>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="w-7 h-7 rounded-md bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-lg leading-none"
          title="New agent"
        >
          +
        </button>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        <ChannelList />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-dot" />
          <span className="text-xs text-gray-500">API connected</span>
        </div>
      </div>
    </div>
  )
}