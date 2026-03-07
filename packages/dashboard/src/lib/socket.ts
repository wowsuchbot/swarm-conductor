import { io, Socket } from 'socket.io-client'
import { useSwarmStore } from './store'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
      transports: ['websocket'],
      autoConnect: true,
    })

    socket.on('connect', () => {
      console.log('[socket] connected', socket?.id)
    })

    socket.on('agent:status', ({ agentId, status }) => {
      useSwarmStore.getState().updateChannelStatus(agentId, status)
    })

    socket.on('agent:message', ({ agentId, message }) => {
      useSwarmStore.getState().appendMessage(agentId, message)
    })

    socket.on('disconnect', () => {
      console.log('[socket] disconnected')
    })
  }
  return socket
}

export function subscribeToAgent(agentId: string) {
  getSocket().emit('agent:subscribe', { agentId })
}

export function unsubscribeFromAgent(agentId: string) {
  getSocket().emit('agent:unsubscribe', { agentId })
}
