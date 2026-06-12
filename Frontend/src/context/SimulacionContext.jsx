import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { io } from 'socket.io-client'
import { API_URL } from '../config/api'
import httpClient from '../config/httpClient'
import { useToast } from '../components/Toast/Toast'

const SimulacionContext = createContext(null)
const SocketContext = createContext(null)

const SOCKET_URL = API_URL

export function SimulacionProvider({ children }) {
  const { addToast } = useToast()
  const socketRef = useRef(null)
  const reconnectAttempt = useRef(0)
  const [isConnected, setIsConnected] = useState(false)
  const [isRunning, setIsRunning]     = useState(false)
  const [cities, setCities]           = useState([])
  const [tickCount, setTickCount]     = useState(0)
  const [lastUpdate, setLastUpdate]   = useState(null)
  const [interval, setIntervalVal]    = useState(3000)
  const [emailAlertas, setEmailAlertas] = useState('')

  const [alertasPendientes, setAlertasPendientes] = useState([])

  const [fronterasSeleccionadas, setFronterasSeleccionadas] = useState([])
  const [isComparing, setIsComparing] = useState(false)
  const [zona1Cfg, setZona1Cfg] = useState({ selectionMode: 'country', pais: '', depto: '', prov: '', departamentos: [], provincias: [], loadingGeo: false, result: null, manualPoints: [], manualName: '' })
  const [zona2Cfg, setZona2Cfg] = useState({ selectionMode: 'country', pais: '', depto: '', prov: '', departamentos: [], provincias: [], loadingGeo: false, result: null, manualPoints: [], manualName: '' })
  const [activeDrawingZone, setActiveDrawingZone] = useState(null)
  const [isSimMode, setIsSimMode] = useState(false)
  const [restSimPoints, setRestSimPoints] = useState([])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      auth: {
        token: localStorage.getItem('token')
      }
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      reconnectAttempt.current = 0
    })
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('reconnect_attempt', (attempt) => {
      reconnectAttempt.current = attempt
    })

    socket.on('simulacion:estado', (payload) => {
      setIsRunning(payload.running)
      if (payload.cities) setCities(payload.cities)
      if (payload.tickCount) setTickCount(payload.tickCount)
    })
    socket.on('simulacion:alertas:ok', (payload) => setEmailAlertas(payload.email))
    socket.on('simulacion:datos', (payload) => {
      setCities(payload.cities)
      setTickCount(payload.tickCount)
      setLastUpdate(payload.timestamp)
    })
    socket.on('alertas:nueva', (nuevas) => {
      const withUid = nuevas.map(a => ({ ...a, _uid: `${Date.now()}-${Math.random()}` }))
      setAlertasPendientes(prev => [...prev, ...withUid])
    })
    socket.on('zona:error', (payload) => {
      addToast(`Error en simulación: ${payload.message}`, 'error')
    })

    return () => { socket.disconnect() }
  }, [])

  const iniciar = useCallback((ms = interval) => {
    setIntervalVal(ms)
    socketRef.current?.emit('simulacion:iniciar', { interval: ms })
  }, [interval])

  const detener = useCallback(() => { socketRef.current?.emit('simulacion:detener') }, [])
  const inyectar = useCallback((cityId, data) => { socketRef.current?.emit('simulacion:inyectar', { cityId, data }) }, [])
  const dismissAlerta = useCallback((_uid) => { setAlertasPendientes(prev => prev.filter(a => a._uid !== _uid)) }, [])
  const suscribirAlertas = useCallback((email) => { socketRef.current?.emit('simulacion:alertas', { email }) }, [])
  const simularRango = useCallback(async (startTime, endTime, intervalMinutes) => {
    const res = await httpClient.post('/simulacion/range', { startTime, endTime, intervalMinutes })
    return res.data
  }, [])

  const value = useMemo(() => ({
    isConnected, isRunning, cities, tickCount, lastUpdate, interval, emailAlertas,
    iniciar, detener, inyectar, alertasPendientes, dismissAlerta, suscribirAlertas, simularRango,
    fronterasSeleccionadas, setFronterasSeleccionadas, isComparing, setIsComparing,
    zona1Cfg, setZona1Cfg, zona2Cfg, setZona2Cfg, isSimMode, setIsSimMode,
    activeDrawingZone, setActiveDrawingZone, restSimPoints, setRestSimPoints
  }), [isConnected, isRunning, cities, tickCount, lastUpdate, interval, emailAlertas,
      iniciar, detener, inyectar, alertasPendientes, dismissAlerta, suscribirAlertas, simularRango,
      fronterasSeleccionadas, isComparing, zona1Cfg, zona2Cfg, isSimMode,
      activeDrawingZone, restSimPoints])

  return (
    <SimulacionContext.Provider value={value}>
      <SocketContext.Provider value={socketRef.current}>
        {children}
      </SocketContext.Provider>
    </SimulacionContext.Provider>
  )
}

export function useSimulacion() {
  const ctx = useContext(SimulacionContext)
  if (!ctx) throw new Error('useSimulacion debe usarse dentro de SimulacionProvider')
  return ctx
}

export function useSocket() {
  return useContext(SocketContext)
}
