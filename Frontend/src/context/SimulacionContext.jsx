import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { API_URL } from '../config/api'

const SimulacionContext = createContext(null)

const SOCKET_URL = API_URL

export function SimulacionProvider({ children }) {
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isRunning, setIsRunning]     = useState(false)
  const [cities, setCities]           = useState([])
  const [tickCount, setTickCount]     = useState(0)
  const [lastUpdate, setLastUpdate]   = useState(null)
  const [interval, setIntervalVal]    = useState(3000)
  const [emailAlertas, setEmailAlertas] = useState('')

  // ─── Alertas en tiempo real ───────────────────────────────────────────────
  const [alertasPendientes, setAlertasPendientes] = useState([])

  // ─── Estado de la simulación de ZONA ──────────────────────────────────────
  const [zonaSimActiva, setZonaSimActiva]           = useState(false)
  const [zonaSimValor, setZonaSimValor]             = useState(null)
  const [zonaSimColor, setZonaSimColor]             = useState(null)  // ← color directo del backend
  const [zonaSimMetrica, setZonaSimMetrica]         = useState(null)
  const [zonaSimUnidad, setZonaSimUnidad]           = useState('')
  const [zonaSimUmbralLabel, setZonaSimUmbralLabel] = useState('')
  const [zonaSimSeveridad, setZonaSimSeveridad]     = useState('')
  const [zonaSimEscNombre, setZonaSimEscNombre]     = useState('')
  const [zonaSimProgreso, setZonaSimProgreso]       = useState(0)
  const [zonaSimSesionId, setZonaSimSesionId]       = useState(null)
  const [zonaSimTotalLecturas, setZonaSimTotalLecturas] = useState(0)
  const [zonaSimCentroide, setZonaSimCentroide]     = useState(null)  // {lat, lng}

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

    socket.on('simulacion:alertas:ok', (payload) => {
      setEmailAlertas(payload.email)
    })

    // Recibir datos en tiempo real
    socket.on('simulacion:datos', (payload) => {
      setCities(payload.cities)
      setTickCount(payload.tickCount)
      setLastUpdate(payload.timestamp)
    })

    // Recibir alertas nuevas del servidor
    socket.on('alertas:nueva', (nuevas) => {
      const withUid = nuevas.map(a => ({ ...a, _uid: `${Date.now()}-${Math.random()}` }))
      setAlertasPendientes(prev => [...prev, ...withUid])
    })

    // ─── Eventos de simulación de ZONA ────────────────────────────────────
    socket.on('zona:estado', (payload) => {
      setZonaSimActiva(payload.running)
      if (!payload.running) {
        setZonaSimValor(null)
        setZonaSimColor(null)
        setZonaSimMetrica(null)
        setZonaSimUnidad('')
        setZonaSimUmbralLabel('')
        setZonaSimSeveridad('')
        setZonaSimEscNombre('')
        setZonaSimProgreso(0)
        setZonaSimSesionId(null)
        setZonaSimCentroide(null)
      } else {
        if (payload.sesionId)     setZonaSimSesionId(payload.sesionId)
        if (payload.metricaClave) setZonaSimMetrica(payload.metricaClave)
        if (payload.centroide)    setZonaSimCentroide(payload.centroide)
        if (payload.totalLecturas) setZonaSimTotalLecturas(payload.totalLecturas)
      }
    })

    socket.on('zona:tick', (payload) => {
      setZonaSimActiva(true)
      setZonaSimValor(payload.valor)
      setZonaSimColor(payload.color)              // color directo del backend
      setZonaSimMetrica(payload.metricaClave)
      setZonaSimUnidad(payload.unidad || '')
      setZonaSimUmbralLabel(payload.umbralLabel || '')
      setZonaSimSeveridad(payload.severidad || '')
      setZonaSimEscNombre(payload.escenarioNombre || '')
      setZonaSimProgreso(payload.progreso || 0)
      if (payload.sesionId) setZonaSimSesionId(payload.sesionId)
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

  /**
   * Elimina una alerta del estado local (dismiss visual).
   * No toca la BD — el reconocimiento persistente se hace en la página de historial.
   */
  const dismissAlerta = useCallback((_uid) => {
    setAlertasPendientes(prev => prev.filter(a => a._uid !== _uid))
  }, [])

  const suscribirAlertas = useCallback((email) => {
    socketRef.current?.emit('simulacion:alertas', { email })
  }, [])

  const simularRango = useCallback(async (startTime, endTime, intervalMinutes) => {
    const res = await fetch(`${SOCKET_URL}/api/simulacion/range`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime, endTime, intervalMinutes })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error en la simulación por rango')
    return data
  }, [])

  // ─── Control de simulación de ZONA ──────────────────────────────────────
  const iniciarZona = useCallback((payload) => {
    socketRef.current?.emit('zona:iniciar', payload)
  }, [])

  const detenerZona = useCallback(() => {
    socketRef.current?.emit('zona:detener')
  }, [])

  const value = {
    isConnected, isRunning, cities, tickCount, lastUpdate, interval, emailAlertas,
    iniciar, detener, inyectar, alertasPendientes, dismissAlerta, suscribirAlertas, simularRango,
    // Zona sim
    zonaSimActiva,
    zonaSimValor,
    zonaSimColor,          // hex directo del backend
    zonaSimMetrica,
    zonaSimUnidad,
    zonaSimUmbralLabel,
    zonaSimSeveridad,
    zonaSimEscNombre,
    zonaSimProgreso,
    zonaSimSesionId,
    zonaSimTotalLecturas,
    zonaSimCentroide,
    iniciarZona,
    detenerZona,
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
