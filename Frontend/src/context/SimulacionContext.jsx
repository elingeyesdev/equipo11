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
  const [zonaSimZonas, setZonaSimZonas]             = useState([]) // Array de zonas
  const [zonaSimMetrica, setZonaSimMetrica]         = useState(null)
  const [zonaSimUnidad, setZonaSimUnidad]           = useState('')
  const [zonaSimEscNombre, setZonaSimEscNombre]     = useState('')
  const [zonaSimProgreso, setZonaSimProgreso]       = useState(0)
  const [zonaSimSesionId, setZonaSimSesionId]       = useState(null)
  const [zonaSimTotalLecturas, setZonaSimTotalLecturas] = useState(0)
  const [zonaSimTiempo, setZonaSimTiempo] = useState(null)

  // ─── Persistencia de Fronteras Seleccionadas ──────────────────────────────
  const [fronterasSeleccionadas, setFronterasSeleccionadas] = useState([]) // [{ geojson, bbox, nombre }]
  const [isComparing, setIsComparing] = useState(false)
  const [zona1Cfg, setZona1Cfg] = useState({ pais: '', depto: '', prov: '', departamentos: [], provincias: [], loadingGeo: false, result: null })
  const [zona2Cfg, setZona2Cfg] = useState({ pais: '', depto: '', prov: '', departamentos: [], provincias: [], loadingGeo: false, result: null })
  const [isSimMode, setIsSimMode] = useState(false)

  // ─── Estado visual del Mapa (Persistente) ──────────────────────────────
  const [isHeatmapActive, setIsHeatmapActive] = useState(false)
  const [isChoroplethActive, setIsChoroplethActive] = useState(false)
  const [heatmapMetric, setHeatmapMetric] = useState('aqi')
  const [showSensors, setShowSensors] = useState(true)
  const [isParticlesActive, setIsParticlesActive] = useState(false)
  const [particleFilters, setParticleFilters] = useState({ rain: false, snow: false, wind: false, fog: false })
  const [isHistoricalMode, setIsHistoricalMode] = useState(false)
  const [isDynamicHistoricalMode, setIsDynamicHistoricalMode] = useState(false)

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
        setZonaSimZonas([])
        setZonaSimMetrica(null)
        setZonaSimUnidad('')
        setZonaSimEscNombre('')
        setZonaSimProgreso(0)
        setZonaSimSesionId(null)
      } else {
        if (payload.sesionId)     setZonaSimSesionId(payload.sesionId)
        if (payload.metricaClave) setZonaSimMetrica(payload.metricaClave)
        if (payload.totalLecturas) setZonaSimTotalLecturas(payload.totalLecturas)
      }
    })

    socket.on('zona:tick', (payload) => {
      setZonaSimActiva(true)
      setZonaSimZonas(payload.zonas || [])
      setZonaSimMetrica(payload.metricaClave)
      setZonaSimUnidad(payload.unidad || '')
      setZonaSimEscNombre(payload.escenarioNombre || '')
      setZonaSimProgreso(payload.progreso || 0)
      setZonaSimTiempo(payload.tiempo || null)
      if (payload.sesionId) setZonaSimSesionId(payload.sesionId)
    })

    socket.on('zona:error', (payload) => {
      console.error('⚠️ Error en simulación de zona:', payload.message)
      alert(`Error en simulación: ${payload.message}`)
      setZonaSimActiva(false)
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
    zonaSimZonas,
    zonaSimMetrica,
    zonaSimUnidad,
    zonaSimEscNombre,
    zonaSimProgreso,
    zonaSimSesionId,
    zonaSimTotalLecturas,
    zonaSimTiempo,
    iniciarZona,
    detenerZona,
    // Fronteras
    fronterasSeleccionadas,
    setFronterasSeleccionadas,
    isComparing,
    setIsComparing,
    zona1Cfg,
    setZona1Cfg,
    zona2Cfg,
    setZona2Cfg,
    isSimMode,
    setIsSimMode,
    isHeatmapActive, setIsHeatmapActive,
    isChoroplethActive, setIsChoroplethActive,
    heatmapMetric, setHeatmapMetric,
    showSensors, setShowSensors,
    isParticlesActive, setIsParticlesActive,
    particleFilters, setParticleFilters,
    isHistoricalMode, setIsHistoricalMode,
    isDynamicHistoricalMode, setIsDynamicHistoricalMode,
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
