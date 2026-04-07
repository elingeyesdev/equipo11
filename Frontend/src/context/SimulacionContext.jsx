/**
 * SimulacionContext — Estado global compartido para datos simulados.
 * 
 * Principios aplicados:
 * - SRP: Solo gestiona la conexión WebSocket y el estado de simulación.
 * - DRY: Toda la lógica de Socket.IO vive aquí; MapaMonitoreo y PanelSimulacion
 *        solo consumen datos, nunca duplican la conexión.
 * - KISS: API mínima expuesta (datos, estado, iniciar, detener).
 * - OCP: Si se agrega un nuevo evento, se añade aquí sin tocar los consumidores.
 */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SimulacionContext = createContext(null)

const SOCKET_URL = 'http://localhost:3000'

export function SimulacionProvider({ children }) {
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isRunning, setIsRunning]     = useState(false)
  const [cities, setCities]           = useState([])
  const [tickCount, setTickCount]     = useState(0)
  const [lastUpdate, setLastUpdate]   = useState(null)
  const [interval, setIntervalVal]    = useState(3000)

  // Conectar al montar, desconectar al desmontar
  useEffect(() => {
    const socket = io(SOCKET_URL)
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('🔌 Conectado al servidor WebSocket')
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      console.log('❌ Desconectado del servidor WebSocket')
    })

    // Recibir estado inicial o cambios de estado
    socket.on('simulacion:estado', (payload) => {
      setIsRunning(payload.running)
      if (payload.cities) setCities(payload.cities)
      if (payload.tickCount) setTickCount(payload.tickCount)
    })

    // Recibir datos en tiempo real
    socket.on('simulacion:datos', (payload) => {
      setCities(payload.cities)
      setTickCount(payload.tickCount)
      setLastUpdate(payload.timestamp)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Funciones de control (memoizadas para evitar re-renders innecesarios)
  const iniciar = useCallback((ms = interval) => {
    setIntervalVal(ms)
    socketRef.current?.emit('simulacion:iniciar', { interval: ms })
  }, [interval])

  const detener = useCallback(() => {
    socketRef.current?.emit('simulacion:detener')
  }, [])

  const inyectar = useCallback((cityId, data) => {
    socketRef.current?.emit('simulacion:inyectar', { cityId, data })
  }, [])

  const value = {
    isConnected,
    isRunning,
    cities,
    tickCount,
    lastUpdate,
    interval,
    iniciar,
    detener,
    inyectar
  }

  return (
    <SimulacionContext.Provider value={value}>
      {children}
    </SimulacionContext.Provider>
  )
}

/**
 * Hook personalizado para consumir el contexto.
 * KISS: Los componentes solo llaman useSimulacion() en vez de useContext(SimulacionContext).
 */
export function useSimulacion() {
  const ctx = useContext(SimulacionContext)
  if (!ctx) throw new Error('useSimulacion debe usarse dentro de SimulacionProvider')
  return ctx
}
