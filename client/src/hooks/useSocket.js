import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export default function useSocket(serverUrl) {
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!serverUrl) return

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      setError(null)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('connect_error', (err) => {
      setError(err.message || '连接失败')
      setIsConnected(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [serverUrl])

  return { socket: socketRef.current, isConnected, error }
}
