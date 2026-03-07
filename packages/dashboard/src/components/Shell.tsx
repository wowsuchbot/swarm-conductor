'use client'

import { useEffect } from 'react'
import { useSwarmStore } from '@/lib/store'
import { getSocket } from '@/lib/socket'
import { Sidebar } from './Sidebar'
import { ChannelView } from './ChannelView'
import { ComposeModal } from './ComposeModal'
import { MobileNav } from './MobileNav'

export function Shell() {
  const { sidebarOpen, setSidebarOpen, composeOpen, channels, activeChannelId } = useSwarmStore()

  useEffect(() => {
    getSocket()
  }, [])

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null

  return (
    <div className="flex h-full bg-surface overflow-hidden">
      {/* Desktop sidebar - always visible */}
      <div className="hidden md:flex md:w-64 md:flex-col md:flex-shrink-0 border-r border-border">
        <Sidebar />
      </div>

      {/* Mobile sidebar - slide-in drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-surface-1 border-r border-border z-50 flex flex-col">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {activeChannel ? (
          <ChannelView channel={activeChannel} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <MobileNav />
      </div>

      {/* Compose modal */}
      {composeOpen && <ComposeModal />}
    </div>
  )
}

function EmptyState() {
  const { setComposeOpen } = useSwarmStore()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center text-3xl">
        ⚡
      </div>
      <h2 className="text-lg font-semibold text-white">No agents running</h2>
      <p className="text-sm text-gray-400 max-w-xs">
        Spawn an agent to get started. Each agent gets its own channel.
      </p>
      <button
        onClick={() => setComposeOpen(true)}
        className="px-4 py-2 bg-accent-blue text-surface font-semibold text-sm rounded-lg hover:bg-blue-400 transition-colors"
      >
        + New Agent
      </button>
    </div>
  )
}