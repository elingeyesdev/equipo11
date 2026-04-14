/**
 * PanelSimulacion — Panel de control y visualización de datos simulados.
 * 
 * Principios aplicados:
 * - SRP: Solo renderiza UI, toda la lógica de datos está en SimulacionContext.
 * - DRY: Reutiliza componentes como MetricCard y CityRow, no repite markup.
 * - KISS: Estructura plana y legible, sin abstracciones innecesarias.
 * - YAGNI: Solo muestra lo que el MVP necesita, sin features extras.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimulacion } from '../../context/SimulacionContext'
import './PanelSimulacion.css'

// Configuración de métricas para renderizar cards (OCP: agregar una métrica = agregar un objeto)
const METRICS = [
  { key: 'aqi',          label: 'Calidad del Aire',  icon: '🌫️', unit: 'AQI', thresholds: [50, 100, 150] },
  { key: 'waterQuality', label: 'Calidad del Agua',  icon: '💧', unit: 'ICA', thresholds: [40, 60, 80] },
  { key: 'noise',        label: 'Nivel de Ruido',    icon: '🔊', unit: 'dB',  thresholds: [50, 65, 80] },
  { key: 'temperature',  label: 'Temperatura',       icon: '🌡️', unit: '°C',  thresholds: [10, 25, 32] },
  { key: 'humidity',     label: 'Humedad',           icon: '💦', unit: '%',   thresholds: [30, 60, 80] },
]

const INTERVAL_OPTIONS = [
  { value: 1000,  label: '1s' },
  { value: 3000,  label: '3s' },
  { value: 5000,  label: '5s' },
  { value: 10000, label: '10s' },
]

/** Retorna una clase de color según el valor y los umbrales */
function getStatusClass(value, thresholds) {
  if (value <= thresholds[0]) return 'status--good'
  if (value <= thresholds[1]) return 'status--moderate'
  if (value <= thresholds[2]) return 'status--warning'
  return 'status--danger'
}

/** Calcula el promedio de una métrica entre todas las ciudades */
function calculateAverage(cities, metricKey) {
  if (!cities.length) return 0
  const sum = cities.reduce((acc, city) => acc + (city.data[metricKey] || 0), 0)
  return Math.round(sum / cities.length)
}

/** Formatea un timestamp ISO a hora local legible */
function formatTime(isoString) {
  if (!isoString) return '--:--:--'
  return new Date(isoString).toLocaleTimeString('es-BO')
}

const EMPTY_INJECT = { temperature: '', aqi: '', waterQuality: '', noise: '', humidity: '' }

function PanelSimulacion() {
  const navigate = useNavigate()
  const { isConnected, isRunning, cities, tickCount, lastUpdate, interval, iniciar, detener, inyectar } = useSimulacion()

  const [injectCity, setInjectCity]       = useState('')
  const [injectValues, setInjectValues]   = useState(EMPTY_INJECT)
  const [injectFeedback, setInjectFeedback] = useState(null) // 'success' | null

  function handleCitySelect(cityId) {
    setInjectCity(cityId)
    const city = cities.find(c => c.id === cityId)
    setInjectValues(city
      ? { temperature: city.data.temperature, aqi: city.data.aqi, waterQuality: city.data.waterQuality, noise: city.data.noise, humidity: city.data.humidity }
      : EMPTY_INJECT
    )
  }

  function handleInjectSubmit(e) {
    e.preventDefault()
    if (!injectCity) return

    const data = {}
    Object.entries(injectValues).forEach(([key, val]) => {
      if (val !== '') data[key] = Number(val)
    })
    if (Object.keys(data).length === 0) return

    inyectar(injectCity, data)
    setInjectFeedback('success')
    setTimeout(() => setInjectFeedback(null), 3000)
  }

  return (
    <div className="panel-sim">
      {/* Encabezado */}
      <div className="panel-sim-header">
        <div>
          <h2 className="panel-sim-title">Panel de Simulación</h2>
          <p className="panel-sim-subtitle">Control y visualización de datos ambientales simulados</p>
        </div>
        <span className="page-tag">Sprint 0</span>
      </div>

      {/* Controles */}
      <div className="sim-controls-card">
        <div className="sim-controls-top">
          <div className="sim-status">
            <span className={`sim-status-dot ${isRunning ? 'sim-status-dot--active' : ''}`}></span>
            <span className="sim-status-text">
              {!isConnected ? 'Sin conexión' : isRunning ? 'Simulación activa' : 'Simulación detenida'}
            </span>
          </div>
          <div className="sim-stats">
            <div className="sim-stat">
              <span className="sim-stat-label">Lecturas</span>
              <span className="sim-stat-value">{tickCount}</span>
            </div>
            <div className="sim-stat">
              <span className="sim-stat-label">Última actualización</span>
              <span className="sim-stat-value">{formatTime(lastUpdate)}</span>
            </div>
            <div className="sim-stat">
              <span className="sim-stat-label">Puntos activos</span>
              <span className="sim-stat-value">{cities.length}/9</span>
            </div>
          </div>
        </div>

        <div className="sim-controls-actions">
          <button
            className="sim-btn sim-btn--start"
            onClick={() => {
              iniciar()
              navigate('/mapa', { state: { openModal: true } })
            }}
            disabled={isRunning || !isConnected}
          >
            ▶ Iniciar
          </button>
          <button
            className="sim-btn sim-btn--stop"
            onClick={detener}
            disabled={!isRunning || !isConnected}
          >
            ⏹ Detener
          </button>
          <div className="sim-interval-selector">
            <label htmlFor="interval-select">Intervalo:</label>
            <select
              id="interval-select"
              value={interval}
              onChange={(e) => {
                const ms = Number(e.target.value)
                if (isRunning) {
                  detener()
                  setTimeout(() => iniciar(ms), 200)
                }
              }}
              disabled={!isConnected}
            >
              {INTERVAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Resumen de promedios */}
      <div className="sim-summary-grid">
        {METRICS.map(metric => {
          const avg = calculateAverage(cities, metric.key)
          return (
            <div key={metric.key} className={`sim-summary-card ${getStatusClass(avg, metric.thresholds)}`}>
              <span className="sim-summary-icon">{metric.icon}</span>
              <div className="sim-summary-info">
                <span className="sim-summary-label">{metric.label}</span>
                <span className="sim-summary-value">{avg} {metric.unit}</span>
              </div>
              <span className="sim-summary-tag">Promedio</span>
            </div>
          )
        })}
      </div>

      {/* Tabla de datos por departamento */}
      <div className="sim-table-card">
        <h3 className="sim-table-title">Datos por Departamento</h3>
        <div className="sim-table-wrapper">
          <table className="sim-table">
            <thead>
              <tr>
                <th>Departamento</th>
                {METRICS.map(m => <th key={m.key}>{m.icon} {m.unit}</th>)}
              </tr>
            </thead>
            <tbody>
              {cities.length === 0 ? (
                <tr>
                  <td colSpan={METRICS.length + 1} className="sim-table-empty">
                    Inicia la simulación para ver datos
                  </td>
                </tr>
              ) : (
                cities.map(city => (
                  <tr key={city.id}>
                    <td className="sim-city-name">
                      <span className="sim-city-dot"></span>
                      {city.name}
                    </td>
                    {METRICS.map(metric => (
                      <td
                        key={metric.key}
                        className={`sim-cell ${getStatusClass(city.data[metric.key], metric.thresholds)}`}
                      >
                        {city.data[metric.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inyección manual de datos */}
      <div className="inject-card">
        <div className="inject-card-header">
          <div>
            <h3 className="inject-title">Inyección Manual de Datos</h3>
            <p className="inject-subtitle">Escribe los valores que quieras y envíalos directamente al mapa para pruebas</p>
          </div>
          {injectFeedback === 'success' && (
            <span className="inject-badge inject-badge--ok">Datos enviados al mapa</span>
          )}
        </div>

        <form className="inject-form" onSubmit={handleInjectSubmit}>
          {/* Selector de departamento */}
          <div className="inject-field inject-field--full">
            <label className="inject-label">Departamento</label>
            <select
              className="inject-select"
              value={injectCity}
              onChange={(e) => handleCitySelect(e.target.value)}
              required
              disabled={!isConnected}
            >
              <option value="">-- Selecciona un departamento --</option>
              {(cities.length > 0 ? cities : [
                { id: 'lapaz', name: 'La Paz' }, { id: 'cochabamba', name: 'Cochabamba' },
                { id: 'santacruz', name: 'Santa Cruz' }, { id: 'oruro', name: 'Oruro' },
                { id: 'potosi', name: 'Potosí' }, { id: 'sucre', name: 'Sucre' },
                { id: 'tarija', name: 'Tarija' }, { id: 'beni', name: 'Trinidad' },
                { id: 'pando', name: 'Cobija' }
              ]).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Inputs de métricas */}
          <div className="inject-metrics-grid">
            {METRICS.map(m => (
              <div key={m.key} className="inject-field">
                <label className="inject-label">{m.icon} {m.label} <span className="inject-unit">({m.unit})</span></label>
                <input
                  type="number"
                  className="inject-input"
                  value={injectValues[m.key]}
                  onChange={(e) => setInjectValues(prev => ({ ...prev, [m.key]: e.target.value }))}
                  placeholder="—"
                  disabled={!injectCity || !isConnected}
                />
              </div>
            ))}
          </div>

          <div className="inject-actions">
            <button
              type="submit"
              className="sim-btn inject-btn-send"
              disabled={!injectCity || !isConnected}
            >
              Enviar al mapa
            </button>
            <button
              type="button"
              className="inject-btn-reset"
              onClick={() => { setInjectCity(''); setInjectValues(EMPTY_INJECT); setInjectFeedback(null) }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Footer informativo */}
      <p className="sim-footer-note">
        ⚡ Los datos se actualizan automáticamente cada {interval / 1000}s cuando la simulación está activa.
      </p>
    </div>
  )
}

export default PanelSimulacion
