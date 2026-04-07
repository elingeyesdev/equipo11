/**
 * PanelSimulacion — Panel de control y visualización de datos simulados.
 * 
 * Principios aplicados:
 * - SRP: Solo renderiza UI, toda la lógica de datos está en SimulacionContext.
 * - DRY: Reutiliza componentes como MetricCard y CityRow, no repite markup.
 * - KISS: Estructura plana y legible, sin abstracciones innecesarias.
 * - YAGNI: Solo muestra lo que el MVP necesita, sin features extras.
 */
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

function PanelSimulacion() {
  const { isConnected, isRunning, cities, tickCount, lastUpdate, interval, iniciar, detener } = useSimulacion()

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
            onClick={() => iniciar()}
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

      {/* Footer informativo */}
      <p className="sim-footer-note">
        ⚡ Los datos se actualizan automáticamente cada {interval / 1000}s cuando la simulación está activa.
      </p>
    </div>
  )
}

export default PanelSimulacion
