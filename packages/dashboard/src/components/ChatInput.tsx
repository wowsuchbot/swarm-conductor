'use client'

import { useState, useRef } from 'react'

interface ChatInputProps {
  channelId: string
  disabled?: boolean
}

export function ChatInput({ channelId, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    if (!value.trim() || sending || disabled) return
    setSending(true)
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/agents/${channelId}/message`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: value.trim() }),
        }
      )
      setValue('')
    } catch (err) {
      console.error('[ChatInput] send failed', err)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-border bg-surface-1 px-4 py-3">
      <div className="flex items-end gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2 focus-within:border-accent-blue transition-colors">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Agent finished' : 'Redirect agent or ask a question... (Enter to send)'}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none resize-none max-h-32 disabled:opacity-40"
          style={{ minHeight: '24px' }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || sending || disabled}
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent-blue flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-400 transition-colors"
        >
          <span className="text-surface text-sm font-bold leading-none">↑</span>
        </button>
      </div>
    </div>
  )
}