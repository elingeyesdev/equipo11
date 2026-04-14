/**
 * ModalSimulacion — Modal de estado de la simulación en tiempo real.
 *
 * Principios aplicados:
 * - SRP: Solo renderiza el estado de simulación, no lo controla.
 * - DRY: Consume useSimulacion() sin duplicar lógica del contexto.
 * - KISS: Overlay simple con tecla Escape y clic fuera para cerrar.
 */
import { useEffect, useCallback } from 'react'
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

/**
 * @param {boolean}  isOpen   — controla visibilidad
 * @param {Function} onClose  — callback para cerrar
 */
function ModalSimulacion({ isOpen, onClose }) {
  const { isRunning, cities, tickCount, lastUpdate, interval } = useSimulacion()

  // Cerrar con Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Estado de simulación">
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Cabecera */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className={`modal-status-dot ${isRunning ? 'modal-status-dot--active' : ''}`}></span>
            <h2 className="modal-title">Estado de Simulación</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">×</button>
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
            <span className="modal-stat-label">Ciudades activas</span>
            <span className="modal-stat-value">{cities.length}/9</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-label">Última actualización</span>
            <span className="modal-stat-value">{formatTime(lastUpdate)}</span>
          </div>
        </div>

        {/* Promedios de métricas */}
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

        <p className="modal-hint">Presiona Esc o haz clic fuera para cerrar</p>
      </div>
    </div>
  )
}

export default ModalSimulacion
