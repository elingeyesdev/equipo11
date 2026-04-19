/**
 * ModalSimulacion — Modal de estado con modo mini (escalado + draggable).
 *
 * Flujo:
 *   hidden → expanded (overlay centrado) → mini (mismo contenido escalado, arrastrable)
 *   mini → expanded (al expandir)
 *
 * En modo mini el usuario puede arrastrar el modal libremente por el mapa.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSimulacion } from '../../context/SimulacionContext'
import './ModalSimulacion.css'

const METRICS = [
  { key: 'temperature',  label: 'Temperatura',      icon: '🌡️', unit: '°C'  },
  { key: 'aqi',          label: 'Calidad del Aire',  icon: '🌫️', unit: 'AQI' },
  { key: 'waterQuality', label: 'Calidad del Agua',  icon: '💧', unit: 'ICA' },
  { key: 'noise',        label: 'Nivel de Ruido',    icon: '🔊', unit: 'dB'  },
  { key: 'humidity',     label: 'Humedad',           icon: '💦', unit: '%'   },
]

function calcPromedio(cities, key) {
  if (!cities.length) return '—'
  const sum = cities.reduce((acc, c) => acc + (c.data[key] || 0), 0)
  return Math.round(sum / cities.length)
}

function formatTime(isoString) {
  if (!isoString) return '--:--:--'
  return new Date(isoString).toLocaleTimeString('es-BO')
}

const AUTO_MINIMIZE_MS = 3000
const MINI_SCALE = 0.55

function ModalSimulacion({ isOpen, onClose }) {
  const { isConnected, isRunning, cities, tickCount, lastUpdate, interval, iniciar, detener } = useSimulacion()

  // mode: 'hidden' | 'expanded' | 'minimizing' | 'mini'
  const [mode, setMode] = useState('hidden')
  const timerRef = useRef(null)
  const hasBeenOpened = useRef(false)

  // --- Drag state ---
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const miniBoxRef = useRef(null)
  const positionInitialized = useRef(false)

  // Calcular posición inicial (esquina derecha del mapa)
  const initPosition = useCallback(() => {
    if (positionInitialized.current) return
    const mapEl = document.querySelector('.map-container')
    if (mapEl) {
      const rect = mapEl.getBoundingClientRect()
      const miniW = 560 * MINI_SCALE
      const miniH = 400 * MINI_SCALE
      setPosition({
        x: rect.width - miniW - 16,
        y: (rect.height - miniH) / 2
      })
      positionInitialized.current = true
    }
  }, [])

  // Cuando isOpen cambia a true → expandir
  useEffect(() => {
    if (isOpen && mode !== 'expanded') {
      setMode('expanded')
      hasBeenOpened.current = true

      timerRef.current = setTimeout(() => {
        setMode('minimizing')
      }, AUTO_MINIMIZE_MS)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [isOpen])

  // Cuando pasa a mini por primera vez, calcular posición
  useEffect(() => {
    if (mode === 'mini') initPosition()
  }, [mode, initPosition])

  // Animación de minimización terminó → pasar a mini
  const handleMinimizeEnd = () => {
    if (mode === 'minimizing') {
      setMode('mini')
      onClose()
    }
  }

  // Cierre manual → ir directo a mini
  const handleManualClose = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMode('mini')
    onClose()
  }, [onClose])

  // Expandir desde mini
  const handleExpand = () => {
    setMode('expanded')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMode('minimizing'), AUTO_MINIMIZE_MS)
  }

  // Cerrar completamente
  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMode('hidden')
    hasBeenOpened.current = false
    positionInitialized.current = false
    onClose()
  }

  // Escape para cerrar expandido
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && mode === 'expanded') handleManualClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mode, handleManualClose])

  // --- Drag handlers ---
  const handleDragStart = (e) => {
    if (mode !== 'mini') return
    e.preventDefault()
    setIsDragging(true)
    // Calcular offset relativo al elemento escalado
    const scaledX = position.x
    const scaledY = position.y
    dragOffset.current = {
      x: e.clientX - scaledX,
      y: e.clientY - scaledY
    }
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e) => {
      const mapEl = document.querySelector('.map-container')
      if (!mapEl) return
      const rect = mapEl.getBoundingClientRect()
      const miniW = 560 * MINI_SCALE
      const miniH = 400 * MINI_SCALE

      let newX = e.clientX - dragOffset.current.x
      let newY = e.clientY - dragOffset.current.y

      // Limitar dentro del mapa
      newX = Math.max(0, Math.min(rect.width - miniW, newX))
      newY = Math.max(0, Math.min(rect.height - miniH, newY))

      setPosition({ x: newX, y: newY })
    }
    const handleUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging])

  // ==================== CONTENIDO COMPARTIDO ====================
  const renderContent = (isMini) => (
    <>
      {/* Cabecera */}
      <div
        className={`modal-header ${isMini ? 'modal-header--draggable' : ''}`}
        onMouseDown={isMini ? handleDragStart : undefined}
      >
        <div className="modal-title-group">
          <span className={`modal-status-dot ${isRunning ? 'modal-status-dot--active' : ''}`}></span>
          <h2 className="modal-title">Estado de Simulación</h2>
        </div>
        <div className="modal-header-actions">
          {isMini && (
            <button className="modal-expand-btn" onClick={handleExpand} title="Expandir">↗</button>
          )}
          <button
            className="modal-close-btn"
            onClick={isMini ? handleDismiss : handleManualClose}
            aria-label="Cerrar"
          >×</button>
        </div>
      </div>

      {/* Stats generales */}
      <div className="modal-stats-row">
        <div className="modal-stat">
          <span className="modal-stat-label">Estado</span>
          <span className={`modal-stat-value ${isRunning ? 'modal-stat--active' : 'modal-stat--stopped'}`}>
            {isRunning ? 'Activa' : 'Detenida'}
          </span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Intervalo</span>
          <span className="modal-stat-value">{interval / 1000}s</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Lecturas</span>
          <span className="modal-stat-value">{tickCount}</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Ciudades</span>
          <span className="modal-stat-value">{cities.length}/9</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Última actualización</span>
          <span className="modal-stat-value">{formatTime(lastUpdate)}</span>
        </div>
      </div>

      {/* Controles */}
      <div className="modal-controls-row">
        <button
          className="modal-ctrl-btn modal-ctrl-btn--start"
          onClick={() => iniciar()}
          disabled={isRunning || !isConnected}
        >▶ Iniciar</button>
        <button
          className="modal-ctrl-btn modal-ctrl-btn--stop"
          onClick={detener}
          disabled={!isRunning || !isConnected}
        >⏹ Detener</button>
      </div>

      {/* Promedios */}
      <h3 className="modal-section-title">Promedios actuales</h3>
      <div className="modal-metrics-grid">
        {METRICS.map(m => (
          <div key={m.key} className="modal-metric-card">
            <span className="modal-metric-icon">{m.icon}</span>
            <span className="modal-metric-label">{m.label}</span>
            <span className="modal-metric-value">
              {calcPromedio(cities, m.key)} <span className="modal-metric-unit">{m.unit}</span>
            </span>
          </div>
        ))}
      </div>

      {!isMini && <p className="modal-hint">Se minimizará automáticamente en unos segundos</p>}
      {isMini && <p className="modal-hint">Arrastra la cabecera para mover · Clic ↗ para expandir</p>}
    </>
  )

  // ==================== RENDER ====================

  // --- Modal expandido (con overlay) ---
  if (mode === 'expanded' || mode === 'minimizing') {
    return (
      <div
        className={`modal-overlay ${mode === 'minimizing' ? 'modal-overlay--fading' : ''}`}
        onClick={mode === 'expanded' ? handleManualClose : undefined}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`modal-box ${mode === 'minimizing' ? 'modal-box--shrinking' : ''}`}
          onClick={e => e.stopPropagation()}
          onAnimationEnd={handleMinimizeEnd}
        >
          {renderContent(false)}
        </div>
      </div>
    )
  }

  // --- Modo mini (mismo modal escalado, arrastrable) ---
  if (mode === 'mini' && hasBeenOpened.current) {
    return (
      <div
        ref={miniBoxRef}
        className={`modal-box modal-box--mini ${isDragging ? 'modal-box--dragging' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `scale(${MINI_SCALE})`,
        }}
      >
        {renderContent(true)}
      </div>
    )
  }

  return null
}

export default ModalSimulacion
