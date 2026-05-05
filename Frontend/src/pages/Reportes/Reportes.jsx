import { useState, useEffect, useMemo } from 'react'
import { useUnidades } from '../../hooks/useUnidades'
import { formatearValor } from '../../utils/unidades'
import { API_BASE } from '../../config/api'
import './Reportes.css'
import '../PagePlaceholder.css'

const CIUDADES = [
  'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro',
  'Potosí', 'Sucre', 'Tarija', 'Trinidad', 'Cobija',
]

const METRICAS_OPTS = [
  { value: 'temperatura', label: 'Temperatura',      sufijo: '°C',   color: 'violet', icon: '🌡' },
  { value: 'aqi',         label: 'Calidad del Aire', sufijo: ' AQI', color: 'rust',   icon: '🌫' },
  { value: 'humedad',     label: 'Humedad',          sufijo: '%',    color: 'river',  icon: '💧' },
  { value: 'ruido',       label: 'Ruido',            sufijo: ' dB',  color: 'amber',  icon: '🔊' },
]

const RANGOS = [
  { label: '24 h', dias: 1 },
  { label: '7 d',  dias: 7 },
  { label: '30 d', dias: 30 },
  { label: 'Todo', dias: null },
]

const PAGE_SIZE = 15

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcStats(datos, key) {
  const vals = datos.map(d => d[key]).filter(v => v != null && !isNaN(v))
  if (!vals.length) return { avg: null, min: null, max: null }
  const sum = vals.reduce((a, b) => a + b, 0)
  return { avg: sum / vals.length, min: Math.min(...vals), max: Math.max(...vals) }
}

// ─── Line Chart (SVG) ─────────────────────────────────────────────────────────
function LineChart({ datos, metrica, colorVar }) {
  const filtered = useMemo(() =>
    [...datos]
      .filter(d => d[metrica] != null && !isNaN(d[metrica]))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)),
    [datos, metrica]
  )

  if (filtered.length < 2) {
    return <div className="rep-chart-empty">Datos insuficientes para la serie temporal</div>
  }

  const W = 560, H = 150, PX = 38, PY = 18
  const step = Math.max(1, Math.floor(filtered.length / 60))
  const pts = filtered.filter((_, i) => i % step === 0)

  const vals = pts.map(d => d[metrica])
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const cx = i => PX + (i / (pts.length - 1)) * (W - PX * 2)
  const cy = v => PY + ((maxV - v) / range) * (H - PY * 2)

  const linePath = pts.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(d[metrica]).toFixed(1)}`
  ).join(' ')

  const areaPath = `${linePath} L${cx(pts.length - 1).toFixed(1)},${(H - PY + 1).toFixed(1)} L${PX},${(H - PY + 1).toFixed(1)} Z`

  const ticks = [minV, minV + range / 2, maxV]
  const stroke = `var(--${colorVar})`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} aria-hidden="true">
      {ticks.map((v, i) => {
        const y = cy(v)
        return (
          <g key={i}>
            <line x1={PX} x2={W - PX} y1={y} y2={y}
              stroke="var(--line)" strokeDasharray="3,3" strokeWidth={0.8} />
            <text x={PX - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill="var(--ink-faint)">
              {v.toFixed(1)}
            </text>
          </g>
        )
      })}
      <path d={areaPath} fill={stroke} fillOpacity={0.08} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round" />
      {pts.length <= 30 && pts.map((d, i) => (
        <circle key={i} cx={cx(i)} cy={cy(d[metrica])} r={2.5} fill={stroke} />
      ))}
    </svg>
  )
}

// ─── Bar Chart (SVG) ──────────────────────────────────────────────────────────
function BarChart({ datos, metrica, colorVar }) {
  const cities = useMemo(() => {
    const map = {}
    datos.forEach(d => {
      const v = d[metrica]
      if (v == null || isNaN(v)) return
      if (!map[d.ciudad]) map[d.ciudad] = { sum: 0, n: 0 }
      map[d.ciudad].sum += v
      map[d.ciudad].n++
    })
    return Object.entries(map)
      .map(([name, { sum, n }]) => ({ name, avg: sum / n }))
      .sort((a, b) => b.avg - a.avg)
  }, [datos, metrica])

  if (!cities.length) return <div className="rep-chart-empty">Sin datos para comparar</div>

  const W = 560, H = 150
  const PAD = { t: 20, r: 12, b: 38, l: 38 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b
  const maxV = Math.max(...cities.map(c => c.avg))
  const gap = cW / cities.length
  const bW = gap * 0.55
  const stroke = `var(--${colorVar})`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} aria-hidden="true">
      {[0, 0.5, 1].map((t, i) => {
        const y = PAD.t + cH * (1 - t)
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
              stroke="var(--line)" strokeDasharray="3,3" strokeWidth={0.8} />
            <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="var(--ink-faint)">
              {(maxV * t).toFixed(0)}
            </text>
          </g>
        )
      })}
      {cities.map((c, i) => {
        const x = PAD.l + i * gap + gap / 2 - bW / 2
        const bH = Math.max(2, (c.avg / maxV) * cH)
        const y = PAD.t + cH - bH
        return (
          <g key={c.name}>
            <rect x={x} y={y} width={bW} height={bH} fill={stroke} fillOpacity={0.65} rx={3} />
            <text x={x + bW / 2} y={H - PAD.b + 13} textAnchor="middle" fontSize={8} fill="var(--ink-mute)">
              {c.name.slice(0, 8)}
            </text>
            <text x={x + bW / 2} y={y - 4} textAnchor="middle" fontSize={8} fill="var(--ink-mute)" fontWeight="600">
              {c.avg.toFixed(1)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, sufijo, colorVar, icon, stats }) {
  const { avg, min, max } = stats
  return (
    <div className="rep-kpi">
      <div className="rep-kpi-head">
        <span className="rep-kpi-icon" style={{
          background: `var(--${colorVar}-soft)`,
          color: `var(--${colorVar})`,
        }}>{icon}</span>
        <span className="rep-kpi-label">{label}</span>
      </div>
      <div className="rep-kpi-value">
        {avg != null ? `${avg.toFixed(1)}${sufijo}` : '—'}
      </div>
      {min != null && (
        <div className="rep-kpi-range">
          <span>mín {min.toFixed(1)}</span>
          <span>máx {max.toFixed(1)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Reportes() {
  const [historial, setHistorial]           = useState([])
  const [loading, setLoading]               = useState(true)
  const [ciudadFiltro, setCiudadFiltro]     = useState('')
  const [fechaInicio, setFechaInicio]       = useState('')
  const [fechaFin, setFechaFin]             = useState('')
  const [metricaGrafico, setMetricaGrafico] = useState('temperatura')
  const [page, setPage]                     = useState(1)
  const { unidades } = useUnidades()

  useEffect(() => {
    fetch(`${API_BASE}/historial`)
      .then(r => r.json())
      .then(data => {
        const flat = []
        data.forEach(t => {
          t.cities.forEach(c => {
            flat.push({
              fecha:       t.timestamp,
              ciudad:      c.name,
              temperatura: c.data.temperatura,
              aqi:         c.data.aqi,
              humedad:     c.data.humedad,
              ruido:       c.data.ruido,
              ica:         c.data.ica,
            })
          })
        })
        setHistorial(flat.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
      })
      .finally(() => setLoading(false))
  }, [])

  const aplicarRango = dias => {
    if (dias === null) {
      setFechaInicio('')
      setFechaFin('')
    } else {
      const now  = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - dias)
      setFechaInicio(from.toISOString().split('T')[0])
      setFechaFin(now.toISOString().split('T')[0])
    }
    setPage(1)
  }

  const datosFiltrados = useMemo(() =>
    historial.filter(row => {
      if (ciudadFiltro && row.ciudad !== ciudadFiltro) return false
      if (fechaInicio && new Date(row.fecha) < new Date(fechaInicio)) return false
      if (fechaFin && new Date(row.fecha) > new Date(fechaFin + 'T23:59:59')) return false
      return true
    }),
    [historial, ciudadFiltro, fechaInicio, fechaFin]
  )

  // Aggregate by timestamp when no city is selected (avg across cities)
  const datosLinea = useMemo(() => {
    if (ciudadFiltro) return datosFiltrados
    const byTime = {}
    datosFiltrados.forEach(d => {
      if (!byTime[d.fecha]) byTime[d.fecha] = { fecha: d.fecha, _n: 0, temperatura: 0, aqi: 0, humedad: 0, ruido: 0, ica: 0 }
      const t = byTime[d.fecha]
      t._n++
      ;['temperatura','aqi','humedad','ruido','ica'].forEach(k => {
        if (d[k] != null && !isNaN(d[k])) t[k] += d[k]
      })
    })
    return Object.values(byTime).map(t => ({
      fecha:       t.fecha,
      temperatura: t._n ? t.temperatura / t._n : null,
      aqi:         t._n ? t.aqi / t._n : null,
      humedad:     t._n ? t.humedad / t._n : null,
      ruido:       t._n ? t.ruido / t._n : null,
      ica:         t._n ? t.ica / t._n : null,
    }))
  }, [datosFiltrados, ciudadFiltro])

  const stats = useMemo(() => ({
    temperatura: calcStats(datosFiltrados, 'temperatura'),
    aqi:         calcStats(datosFiltrados, 'aqi'),
    humedad:     calcStats(datosFiltrados, 'humedad'),
    ruido:       calcStats(datosFiltrados, 'ruido'),
  }), [datosFiltrados])

  const totalPaginas = Math.ceil(datosFiltrados.length / PAGE_SIZE)
  const datosPagina  = datosFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const metricaActual = METRICAS_OPTS.find(m => m.value === metricaGrafico) ?? METRICAS_OPTS[0]

  const descargarReporte = async formato => {
    try {
      const payload = {
        formato,
        titulo: `Reporte Ambiental${ciudadFiltro ? ` — ${ciudadFiltro}` : ' — Todas las ciudades'}`,
        columnas: [
          { header: 'Fecha y Hora',  key: 'fechaFmt' },
          { header: 'Ciudad',        key: 'ciudad' },
          { header: 'Temp (°C)',     key: 'temperaturaFmt' },
          { header: 'AQI',           key: 'aqiFmt' },
          { header: 'Humedad (%)',   key: 'humedadFmt' },
          { header: 'Ruido (dB)',    key: 'ruidoFmt' },
          { header: 'ICA',           key: 'icaFmt' },
        ],
        datos: datosFiltrados.map(d => ({
          fechaFmt:       new Date(d.fecha).toLocaleString('es-BO'),
          ciudad:         d.ciudad,
          temperaturaFmt: formatearValor('temperatura', d.temperatura, unidades.temperatura),
          aqiFmt:         formatearValor('aqi',         d.aqi,         unidades.aqi),
          humedadFmt:     formatearValor('humedad',     d.humedad,     unidades.humedad),
          ruidoFmt:       formatearValor('ruido',       d.ruido,       unidades.ruido),
          icaFmt:         d.ica != null ? `${Number(d.ica).toFixed(0)} ICA` : '—',
        })),
      }

      const res = await fetch(`${API_BASE}/reportes/generar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error al generar el reporte')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), {
        href:     url,
        download: `reporte_ambiental.${formato === 'excel' ? 'xlsx' : 'pdf'}`,
      })
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="page reportes-page">

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Análisis de datos</p>
          <h1 className="page-heading">Reportes <em>Ambientales</em></h1>
          <p className="page-desc">
            Explora el historial de lecturas por localidad, visualiza tendencias
            estadísticas y exporta los datos en PDF o Excel.
          </p>
        </div>
        <span className="page-tag">{datosFiltrados.length} registros</span>
      </div>

      {/* ─── KPI Cards ──────────────────────────────────────── */}
      <div className="rep-kpi-grid">
        <KpiCard label="Temperatura"      sufijo="°C"   colorVar="violet" icon="🌡" stats={stats.temperatura} />
        <KpiCard label="Calidad del Aire" sufijo=" AQI" colorVar="rust"   icon="🌫" stats={stats.aqi} />
        <KpiCard label="Humedad"          sufijo="%"    colorVar="river"  icon="💧" stats={stats.humedad} />
        <KpiCard label="Ruido"            sufijo=" dB"  colorVar="amber"  icon="🔊" stats={stats.ruido} />
      </div>

      {/* ─── Filtros ────────────────────────────────────────── */}
      <div className="rep-filtros">
        <div className="rep-filtros-row">

          <label className="rep-label">
            Localidad
            <select
              className="rep-select"
              value={ciudadFiltro}
              onChange={e => { setCiudadFiltro(e.target.value); setPage(1) }}
            >
              <option value="">Todas las ciudades</option>
              {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="rep-label">
            Desde
            <input
              type="date" className="rep-input" value={fechaInicio}
              onChange={e => { setFechaInicio(e.target.value); setPage(1) }}
            />
          </label>

          <label className="rep-label">
            Hasta
            <input
              type="date" className="rep-input" value={fechaFin}
              onChange={e => { setFechaFin(e.target.value); setPage(1) }}
            />
          </label>

          <div className="rep-rangos">
            <span className="rep-rangos-label">Rango rápido</span>
            <div className="rep-rangos-btns">
              {RANGOS.map(r => (
                <button key={r.label} className="rep-rango-btn" onClick={() => aplicarRango(r.dias)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rep-actions">
            <button className="rep-export-btn rep-export-pdf" onClick={() => descargarReporte('pdf')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              PDF
            </button>
            <button className="rep-export-btn rep-export-xl" onClick={() => descargarReporte('excel')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M3 15h18M9 3v18"/>
              </svg>
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* ─── Gráficos ───────────────────────────────────────── */}
      <div className="rep-charts">
        <div className="rep-chart-tabs">
          {METRICAS_OPTS.map(m => (
            <button
              key={m.value}
              className={`rep-chart-tab${metricaGrafico === m.value ? ' rep-chart-tab--active' : ''}`}
              style={metricaGrafico === m.value
                ? { borderColor: `var(--${m.color})`, color: `var(--${m.color})`, background: `var(--${m.color}-soft)` }
                : {}}
              onClick={() => setMetricaGrafico(m.value)}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div className="rep-charts-grid">
          <div className="rep-chart-card">
            <div className="rep-chart-title">
              Evolución temporal
              <span className="rep-chart-sub">
                {ciudadFiltro ? ciudadFiltro : 'promedio · todas las ciudades'}
              </span>
            </div>
            {loading
              ? <div className="rep-chart-empty">Cargando…</div>
              : <LineChart datos={datosLinea} metrica={metricaGrafico} colorVar={metricaActual.color} />
            }
          </div>

          <div className="rep-chart-card">
            <div className="rep-chart-title">
              Promedio por ciudad
              <span className="rep-chart-sub">{metricaActual.label}</span>
            </div>
            {loading
              ? <div className="rep-chart-empty">Cargando…</div>
              : <BarChart datos={datosFiltrados} metrica={metricaGrafico} colorVar={metricaActual.color} />
            }
          </div>
        </div>
      </div>

      {/* ─── Tabla ──────────────────────────────────────────── */}
      <div className="rep-tabla-wrap">
        {loading ? (
          <div className="rep-estado">Cargando historial de datos…</div>
        ) : datosFiltrados.length === 0 ? (
          <div className="rep-estado">No hay registros para los filtros seleccionados.</div>
        ) : (
          <table className="rep-tabla">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Ciudad</th>
                <th>Temperatura</th>
                <th>AQI</th>
                <th>Humedad</th>
                <th>Ruido</th>
                <th>ICA</th>
              </tr>
            </thead>
            <tbody>
              {datosPagina.map((row, i) => (
                <tr key={i}>
                  <td className="rep-td-fecha">
                    {new Date(row.fecha).toLocaleString('es-BO', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="rep-td-ciudad">{row.ciudad}</td>
                  <td className="rep-td-valor">{formatearValor('temperatura', row.temperatura, unidades.temperatura)}</td>
                  <td className="rep-td-valor">{formatearValor('aqi',         row.aqi,         unidades.aqi)}</td>
                  <td className="rep-td-valor">{formatearValor('humedad',     row.humedad,     unidades.humedad)}</td>
                  <td className="rep-td-valor">{formatearValor('ruido',       row.ruido,       unidades.ruido)}</td>
                  <td className="rep-td-valor">
                    {row.ica != null ? `${Number(row.ica).toFixed(0)} ICA` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Paginación ─────────────────────────────────────── */}
      {totalPaginas > 1 && (
        <div className="rep-paginacion">
          <button className="rep-pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ← Anterior
          </button>
          <span className="rep-pag-info">Página {page} de {totalPaginas}</span>
          <button className="rep-pag-btn" disabled={page >= totalPaginas} onClick={() => setPage(p => p + 1)}>
            Siguiente →
          </button>
        </div>
      )}

      <p className="rep-nota">
        Mostrando {datosPagina.length} de {datosFiltrados.length} registros
        · El archivo exportado incluye todos los registros filtrados.
      </p>
    </div>
  )
}
