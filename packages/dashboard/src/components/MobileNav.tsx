'use client'

import { useSwarmStore } from '@/lib/store'

export function MobileNav() {
  const { setSidebarOpen, setComposeOpen, channels } = useSwarmStore()
  const running = channels.filter((c) => c.status === 'running').length

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-border flex items-center justify-around px-4 py-2 z-30 md:hidden safe-area-bottom">
      <button
        onClick={() => setSidebarOpen(true)}
        className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors relative"
      >
        <span className="text-xl">☰</span>
        <span className="text-[10px]">Channels</span>
        {running > 0 && (
          <span className="absolute -top-1 -right-2 w-4 h-4 bg-accent-green rounded-full text-[9px] text-surface font-bold flex items-center justify-center">
            {running}
          </span>
        )}
      </button>

      <button
        onClick={() => setComposeOpen(true)}
        className="w-12 h-12 rounded-full bg-accent-blue flex items-center justify-center shadow-lg hover:bg-blue-400 transition-colors"
      >
        <span className="text-surface text-2xl font-bold leading-none">+</span>
      </button>

      <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
        <span className="text-xl">⚙</span>
        <span className="text-[10px]">Settings</span>
      </button>
    </div>
  )
}