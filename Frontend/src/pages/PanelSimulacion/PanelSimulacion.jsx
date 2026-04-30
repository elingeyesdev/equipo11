/**
 * PanelSimulacion — Panel de control y visualización de datos simulados.
 * 
 * Principios aplicados:
 * - SRP: Solo renderiza UI, toda la lógica de datos está en SimulacionContext.
 * - DRY: Reutiliza componentes como MetricCard y CityRow, no repite markup.
 * - KISS: Estructura plana y legible, sin abstracciones innecesarias.
 * - YAGNI: Solo muestra lo que el MVP necesita, sin features extras.
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimulacion } from '../../context/SimulacionContext'
import { useUnidades } from '../../hooks/useUnidades'
import { formatearValor, invertirValor, METRICAS_UNIDADES } from '../../utils/unidades'
import './PanelSimulacion.css'

// Configuración de métricas para renderizar cards (OCP: agregar una métrica = agregar un objeto)
const METRICS = [
  { key: 'aqi',        label: 'Calidad del Aire',  icon: '🌫️', unit: 'AQI', thresholds: [50, 100, 150] },
  { key: 'ica',        label: 'Calidad del Agua',  icon: '💧', unit: 'ICA', thresholds: [40, 60, 80] },
  { key: 'ruido',      label: 'Nivel de Ruido',    icon: '🔊', unit: 'dB',  thresholds: [50, 65, 80] },
  { key: 'temperatura',label: 'Temperatura',       icon: '🌡️', unit: '°C',  thresholds: [10, 25, 32] },
  { key: 'humedad',    label: 'Humedad',           icon: '💦', unit: '%',   thresholds: [30, 60, 80] },
]

// Rangos válidos para inyección manual (espejo del backend)
const METRIC_LIMITS = {
  temperatura: { min: -40, max: 60 },
  aqi:         { min: 0,   max: 500 },
  ica:         { min: 0,   max: 100 },
  ruido:       { min: 0,   max: 140 },
  humedad:     { min: 0,   max: 100 },
}

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

/** Etiqueta legible del estado */
function getStatusLabel(value, thresholds) {
  if (value <= thresholds[0]) return 'Bueno'
  if (value <= thresholds[1]) return 'Moderado'
  if (value <= thresholds[2]) return 'Alerta'
  return 'Crítico'
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

const EMPTY_INJECT = { temperatura: '', aqi: '', ica: '', ruido: '', humedad: '' }

function PanelSimulacion() {
  const navigate = useNavigate()
  const { 
    isRunning, 
    isConnected, 
    cities, 
    tickCount, 
    lastUpdate, 
    interval, 
    iniciar, 
    detener,
    simularRango,
    inyectar, 
    suscribirAlertas,
    emailAlertas 
  } = useSimulacion()

  // Estados para simulación por lotes
  const [batchStart, setBatchStart] = useState('')
  const [batchEnd, setBatchEnd] = useState('')
  const [batchInterval, setBatchInterval] = useState(60)
  const [isBatchRunning, setIsBatchRunning] = useState(false)

  const handleBatchSimulate = async () => {
    if (!batchStart || !batchEnd) {
      alert('Por favor selecciona fecha de inicio y fin.')
      return
    }
    setIsBatchRunning(true)
    try {
      const res = await simularRango(batchStart, batchEnd, batchInterval)
      alert(`✅ Éxito: Se generaron ${Math.round(res.dataPointsPerCity)} puntos de datos por ciudad.`)
    } catch (err) {
      alert(`❌ Error: ${err.message}`)
    } finally {
      setIsBatchRunning(false)
    }
  }

  const { unidades, cambiarUnidad } = useUnidades()

  const [alertEmailInput, setAlertEmailInput] = useState('')

  // injectValues almacena los valores en UNIDAD BASE internamente.
  // Los inputs los muestran convertidos según la unidad activa y convierten de vuelta al cambiar.
  const [injectCity, setInjectCity]     = useState('')
  const [injectValues, setInjectValues] = useState(EMPTY_INJECT)

  function handleCitySelect(cityId) {
    setInjectCity(cityId)
    const city = cities.find(c => c.id === cityId)
    setInjectValues(city
      ? { temperatura: city.data.temperatura, aqi: city.data.aqi, ica: city.data.ica, ruido: city.data.ruido, humedad: city.data.humedad }
      : EMPTY_INJECT
    )
  }

  function handleInjectSubmit(e) {
    e.preventDefault()
    if (!injectCity) return

    // injectValues ya está en unidades base; enviar directamente
    const data = {}
    Object.entries(injectValues).forEach(([key, val]) => {
      if (val !== '') data[key] = parseFloat(Number(val).toFixed(2))
    })
    if (Object.keys(data).length === 0) return

    inyectar(injectCity, data)
    navigate('/mapa', { state: { ciudad: injectCity, abrirPanel: true } })
  }

  /** Devuelve el valor a mostrar en el input (unidad activa, redondeado) */
  function injectDisplayValue(metricKey) {
    const base = injectValues[metricKey]
    if (base === '') return ''
    const cfg = METRICAS_UNIDADES[metricKey]
    const unit = cfg?.unidades.find(u => u.key === unidades[metricKey]) ?? cfg?.unidades[0]
    return parseFloat(unit.convertir(Number(base)).toFixed(unit.precision))
  }

  /** Guarda en unidad base al escribir en el input */
  function handleInjectChange(metricKey, displayVal) {
    if (displayVal === '') {
      setInjectValues(prev => ({ ...prev, [metricKey]: '' }))
      return
    }
    const base = invertirValor(metricKey, Number(displayVal), unidades[metricKey])
    setInjectValues(prev => ({ ...prev, [metricKey]: base }))
  }

  function handleAlertSubmit(e) {
    e.preventDefault()
    if (!alertEmailInput) return
    suscribirAlertas(alertEmailInput)
    setAlertEmailInput('')
  }

  return (
    <div className="panel-sim">
      {/* Encabezado */}
      <div className="panel-sim-header">
        <div>
          <div className="panel-sim-eyebrow">Consola de simulación · tick {tickCount}</div>
          <h2 className="panel-sim-title">Panel de <em>simulación</em></h2>
          <p className="panel-sim-subtitle">Genera lecturas sintéticas para probar el pipeline, visualizar escenarios extremos o sembrar datos para demos.</p>
        </div>
        <span className="page-tag">Operación</span>
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
            ▶ Iniciar Tiempo Real
          </button>
          <button
            className="sim-btn sim-btn--stop"
            onClick={detener}
            disabled={!isRunning || !isConnected}
          >
            ⏹ Detener
          </button>
          <div className="sim-interval-selector">
            <label htmlFor="interval-select">Tick:</label>
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

        <div className="sim-batch-card">
          <div className="sim-batch-header">
            <p className="sim-batch-title">⚡ Simulación por Lotes (Histórico/Futuro)</p>
            <p className="sim-batch-hint">Genera datos masivos instantáneamente</p>
          </div>
          <div className="sim-batch-body">
            <div className="sim-batch-row">
              <div className="sim-batch-field">
                <label>Inicio</label>
                <input 
                  type="datetime-local" 
                  value={batchStart} 
                  onChange={e => setBatchStart(e.target.value)}
                />
              </div>
              <div className="sim-batch-field">
                <label>Fin</label>
                <input 
                  type="datetime-local" 
                  value={batchEnd} 
                  onChange={e => setBatchEnd(e.target.value)}
                />
              </div>
              <div className="sim-batch-field">
                <label>Intervalo</label>
                <select value={batchInterval} onChange={e => setBatchInterval(Number(e.target.value))}>
                  <option value={30}>Media hora</option>
                  <option value={60}>1 hora</option>
                  <option value={120}>2 horas</option>
                  <option value={240}>4 horas</option>
                </select>
              </div>
            </div>
            <button 
              className="sim-btn sim-btn--batch"
              onClick={handleBatchSimulate}
              disabled={!isConnected || isBatchRunning}
            >
              {isBatchRunning ? '⏳ Procesando...' : '🚀 Generar Datos'}
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Unidades de Medida */}
      <div className="sim-units-card">
        <div className="sim-units-header">
          <p className="sim-units-title">Unidades de medida</p>
          <p className="sim-units-hint">Los cambios aplican en todo el panel y el mapa</p>
        </div>
        <div className="sim-units-body">
          {/* Métricas con múltiples unidades: pills interactivos */}
          {Object.entries(METRICAS_UNIDADES)
            .filter(([, cfg]) => cfg.unidades.length > 1)
            .map(([key, cfg]) => (
              <div key={key} className="sim-unit-group">
                <span className="sim-unit-group-label">{cfg.icon} {cfg.label}</span>
                <div className="sim-unit-pills">
                  {cfg.unidades.map(u => (
                    <button
                      key={u.key}
                      type="button"
                      className={`sim-unit-pill ${unidades[key] === u.key ? 'sim-unit-pill--active' : ''}`}
                      onClick={() => cambiarUnidad(key, u.key)}
                    >
                      {u.sufijo.trim() || u.key}
                    </button>
                  ))}
                </div>
              </div>
            ))
          }
          {/* Métricas con unidad única: informativo */}
          <div className="sim-unit-fixed-row">
            <span className="sim-unit-fixed-label">Unidad fija:</span>
            {Object.entries(METRICAS_UNIDADES)
              .filter(([, cfg]) => cfg.unidades.length === 1)
              .map(([key, cfg]) => (
                <span key={key} className="sim-unit-fixed-badge">
                  {cfg.icon} {cfg.unidades[0].sufijo.trim()}
                </span>
              ))
            }
          </div>
        </div>
      </div>

      {/* Resumen de promedios */}
      <div className="sim-summary-grid">
        {METRICS.map(metric => {
          const avg = calculateAverage(cities, metric.key)
          const statusClass = getStatusClass(avg, metric.thresholds)
          const statusLabel = getStatusLabel(avg, metric.thresholds)
          return (
            <div key={metric.key} className={`sim-summary-card ${statusClass}`}>
              <div className="sim-summary-header">
                <span className="sim-summary-icon">{metric.icon}</span>
                <span className="sim-summary-label">{metric.label}</span>
                {cities.length > 0 && (
                  <span className={`sim-summary-status ${statusClass}`}>{statusLabel}</span>
                )}
              </div>
              <span className="sim-summary-value">
                {cities.length > 0 ? formatearValor(metric.key, avg, unidades[metric.key]) : '—'}
              </span>
              <span className="sim-summary-tag">Promedio · {cities.length} departamentos</span>
            </div>
          )
        })}
      </div>

      {/* Tabla de datos por departamento */}
      <div className="sim-table-card">
        <h3 className="sim-table-title">Datos <em>por departamento</em></h3>
        <div className="sim-table-wrapper">
          <table className="sim-table">
            <thead>
              <tr>
                <th>Departamento</th>
                {METRICS.map(m => {
                  const unitCfg = METRICAS_UNIDADES[m.key]
                  const unitActiva = unitCfg?.unidades.find(u => u.key === unidades[m.key]) ?? unitCfg?.unidades[0]
                  return (
                    <th key={m.key}>
                      <span className="th-icon">{m.icon}</span>
                      <span className="th-unit">{unitActiva?.sufijo.trim() || m.unit}</span>
                    </th>
                  )
                })}
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
                      <span className="sim-city-name-inner">
                        <span className="sim-city-dot"></span>
                        {city.name}
                      </span>
                    </td>
                    {METRICS.map(metric => {
                      const rawVal = city.data[metric.key]
                      const unitCfg = METRICAS_UNIDADES[metric.key]
                      const unitActiva = unitCfg?.unidades.find(u => u.key === unidades[metric.key]) ?? unitCfg?.unidades[0]
                      const displayVal = unitActiva ? unitActiva.convertir(rawVal).toFixed(unitActiva.precision) : rawVal
                      return (
                        <td
                          key={metric.key}
                          className={`sim-cell ${getStatusClass(rawVal, metric.thresholds)}`}
                        >
                          {displayVal}
                        </td>
                      )
                    })}
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
            <h3 className="inject-title">Inyección <em>manual</em> de datos</h3>
            <p className="inject-subtitle">Escribe los valores que quieras y envíalos directamente al mapa para pruebas</p>
          </div>
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
            {METRICS.map(m => {
              const unitCfg = METRICAS_UNIDADES[m.key]
              const unitActiva = unitCfg?.unidades.find(u => u.key === unidades[m.key]) ?? unitCfg?.unidades[0]
              const step = unitActiva ? Math.pow(10, -unitActiva.precision) : 1
              return (
                <div key={m.key} className="inject-field">
                  <label className="inject-label">
                    {m.icon} {m.label} <span className="inject-unit">({unitActiva?.sufijo.trim() || m.unit})</span>
                  </label>
                  <input
                    type="number"
                    step={step}
                    min={METRIC_LIMITS[m.key]?.min ?? 0}
                    max={METRIC_LIMITS[m.key]?.max ?? 100}
                    className="inject-input"
                    value={injectDisplayValue(m.key)}
                    onChange={(e) => handleInjectChange(m.key, e.target.value)}
                    placeholder="—"
                    disabled={!injectCity || !isConnected}
                  />
                </div>
              )
            })}
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
              onClick={() => { setInjectCity(''); setInjectValues(EMPTY_INJECT) }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Suscripción a Alertas */}
      <div className="inject-card" style={{ marginTop: '2rem' }}>
        <div className="inject-card-header">
          <div>
            <h3 className="inject-title">Alertas por <em>Umbrales</em></h3>
            <p className="inject-subtitle">Recibe un correo si los indicadores de cualquier ciudad alcanzan niveles críticos</p>
          </div>
        </div>

        <form className="inject-form" onSubmit={handleAlertSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="inject-field" style={{ flex: 1 }}>
            <label className="inject-label">Correo electrónico</label>
            <input
              type="email"
              className="inject-input"
              value={alertEmailInput}
              onChange={(e) => setAlertEmailInput(e.target.value)}
              placeholder="admin@envirosense.bo"
              disabled={!isConnected}
            />
          </div>
          <button
            type="submit"
            className="sim-btn inject-btn-send"
            disabled={!alertEmailInput || !isConnected}
            style={{ marginBottom: '10px' }}
          >
            Suscribirse
          </button>
        </form>
        {emailAlertas && (
          <p style={{ marginTop: '1rem', color: '#10ac84', fontSize: '0.9rem' }}>
            ✓ Enviando alertas a: <b>{emailAlertas}</b>
          </p>
        )}
      </div>

      {/* Footer informativo */}
      <p className="sim-footer-note">
        ⚡ Los datos se actualizan automáticamente cada {interval / 1000}s cuando la simulación está activa.
      </p>
    </div>
  )
}

export default PanelSimulacion
