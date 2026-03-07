'use client'

import { useEffect, useRef, useState } from 'react'
import { AgentChannel, Message } from '@/lib/store'
import { clsx } from 'clsx'

function ToolCallCard({ msg }: { msg: Message }) {
  const [open, setOpen] = useState(false)
  const tc = msg.toolCall!
  return (
    <div className="rounded-lg border border-border bg-surface-2 overflow-hidden text-xs font-mono">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-3 transition-colors text-left"
      >
        <span className="text-accent-purple">⚙</span>
        <span className="text-gray-300 font-semibold">{tc.tool}</span>
        {tc.duration && (
          <span className="ml-auto text-gray-600">{tc.duration}ms</span>
        )}
        <span className="text-gray-600 ml-1">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          <div>
            <p className="text-gray-600 mb-1">args</p>
            <pre className="text-gray-400 whitespace-pre-wrap break-all text-[11px]">
              {JSON.stringify(tc.args, null, 2)}
            </pre>
          </div>
          {tc.result && (
            <div>
              <p className="text-gray-600 mb-1">result</p>
              <pre className="text-gray-400 whitespace-pre-wrap break-all text-[11px]">{tc.result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ArtifactCard({ msg }: { msg: Message }) {
  const art = msg.artifact!
  if (art.type === 'image') {
    return (
      <div className="rounded-lg border border-border overflow-hidden max-w-sm">
        <img src={art.url || art.content} alt={art.filename || 'artifact'} className="w-full" />
        {art.filename && (
          <p className="px-3 py-1.5 text-xs text-gray-500 bg-surface-2">{art.filename}</p>
        )}
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-surface-2 overflow-hidden text-xs">
      {art.filename && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-3">
          <span className="text-gray-400">📄</span>
          <span className="text-gray-300 font-mono">{art.filename}</span>
          {art.language && (
            <span className="ml-auto text-gray-600 text-[10px]">{art.language}</span>
          )}
        </div>
      )}
      <pre className="px-3 py-2 font-mono text-gray-300 whitespace-pre-wrap break-all text-[11px] overflow-x-auto max-h-64">
        {art.content}
      </pre>
    </div>
  )
}

function MessageRow({ msg }: { msg: Message }) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex gap-3 px-4 py-1.5 group hover:bg-surface-1/40 transition-colors">
      <span className="text-[10px] text-gray-600 font-mono mt-0.5 w-10 flex-shrink-0 pt-0.5">{time}</span>
      <div className="flex-1 min-w-0 space-y-1.5">
        {msg.type === 'text' && (
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        )}
        {msg.type === 'tool_call' && <ToolCallCard msg={msg} />}
        {msg.type === 'artifact' && <ArtifactCard msg={msg} />}
        {msg.type === 'status' && (
          <p className="text-xs text-gray-500 italic">{msg.content}</p>
        )}
      </div>
    </div>
  )
}

export function MessageFeed({ channel }: { channel: AgentChannel }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [channel.messages.length])

  if (channel.messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-gray-600">Agent is starting...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
      {channel.messages.map((msg) => (
        <MessageRow key={msg.id} msg={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}