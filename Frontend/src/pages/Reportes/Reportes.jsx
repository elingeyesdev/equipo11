import { useState, useEffect, useMemo } from 'react'
import { useUnidades } from '../../hooks/useUnidades'
import { formatearValor } from '../../utils/unidades'
import { useToast } from '../../components/Toast/Toast'
import { formatDateTime } from '../../utils/formatters'
import httpClient from '../../config/httpClient'
import LineChart from './LineChart'
import BarChart from './BarChart'
import KpiCard from './KpiCard'
import { CIUDADES, METRICAS_OPTS, RANGOS, PAGE_SIZE, calcStats } from './constants'
import './Reportes.css'
import '../PagePlaceholder.css'

export default function Reportes() {
  const { addToast } = useToast()
  const [historial, setHistorial]           = useState([])
  const [loading, setLoading]               = useState(true)
  const [ciudadFiltro, setCiudadFiltro]     = useState('')
  const [ciudadFiltro2, setCiudadFiltro2]   = useState('')
  const [fechaInicio, setFechaInicio]       = useState('')
  const [fechaFin, setFechaFin]             = useState('')
  const [metricaGrafico, setMetricaGrafico] = useState('temperatura')
  const [page, setPage]                     = useState(1)
  const { unidades } = useUnidades()

  useEffect(() => {
    httpClient.get('/historial')
      .then(res => res.data.data)
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

  const ciudadesDisponibles = useMemo(() => {
    const s = new Set(CIUDADES)
    historial.forEach(d => s.add(d.ciudad))
    return Array.from(s).sort()
  }, [historial])

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
      if (ciudadFiltro || ciudadFiltro2) {
        if (row.ciudad !== ciudadFiltro && row.ciudad !== ciudadFiltro2) return false
      }
      if (fechaInicio && new Date(row.fecha) < new Date(fechaInicio)) return false
      if (fechaFin && new Date(row.fecha) > new Date(fechaFin + 'T23:59:59')) return false
      return true
    }),
    [historial, ciudadFiltro, ciudadFiltro2, fechaInicio, fechaFin]
  )

  const metricaActual = METRICAS_OPTS.find(m => m.value === metricaGrafico) ?? METRICAS_OPTS[0]

  const seriesLinea = useMemo(() => {
    const s = []
    if (ciudadFiltro) {
       s.push({
         name: ciudadFiltro,
         datos: datosFiltrados.filter(d => d.ciudad === ciudadFiltro),
         colorVar: metricaActual.color
       })
    }
    if (ciudadFiltro2) {
       s.push({
         name: ciudadFiltro2,
         datos: datosFiltrados.filter(d => d.ciudad === ciudadFiltro2),
         colorVar: metricaActual.color === 'river' ? 'moss' : 'river'
       })
    }
    if (s.length === 0) {
      const byTime = {}
      datosFiltrados.forEach(d => {
        if (!byTime[d.fecha]) byTime[d.fecha] = { fecha: d.fecha, _n: 0, v: 0 }
        const t = byTime[d.fecha]
        if (d[metricaGrafico] != null && !isNaN(d[metricaGrafico])) {
          t.v += d[metricaGrafico]
          t._n++
        }
      })
      const prom = Object.values(byTime)
        .map(t => ({ fecha: t.fecha, [metricaGrafico]: t._n ? t.v / t._n : null }))
        .sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
      s.push({ name: 'Promedio general', datos: prom, colorVar: metricaActual.color })
    }
    return s
  }, [datosFiltrados, ciudadFiltro, ciudadFiltro2, metricaActual, metricaGrafico])

  const stats = useMemo(() => ({
    temperatura: calcStats(datosFiltrados, 'temperatura'),
    aqi:         calcStats(datosFiltrados, 'aqi'),
    humedad:     calcStats(datosFiltrados, 'humedad'),
    ruido:       calcStats(datosFiltrados, 'ruido'),
  }), [datosFiltrados])

  const totalPaginas = Math.ceil(datosFiltrados.length / PAGE_SIZE)
  const datosPagina  = datosFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const descargarReporte = async formato => {
    try {
      const payload = {
        formato,
        titulo: `Reporte Ambiental${ciudadFiltro ? (ciudadFiltro2 ? ` — ${ciudadFiltro} vs ${ciudadFiltro2}` : ` — ${ciudadFiltro}`) : ' — Todas las ciudades'}`,
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
          fechaFmt:       formatDateTime(d.fecha),
          ciudad:         d.ciudad,
          temperaturaFmt: formatearValor('temperatura', d.temperatura, unidades.temperatura),
          aqiFmt:         formatearValor('aqi',         d.aqi,         unidades.aqi),
          humedadFmt:     formatearValor('humedad',     d.humedad,     unidades.humedad),
          ruidoFmt:       formatearValor('ruido',       d.ruido,       unidades.ruido),
          icaFmt:         d.ica != null ? `${Number(d.ica).toFixed(0)} ICA` : '—',
        })),
      }

      const res = await httpClient.post('/reportes/generar', payload, { responseType: 'blob' })
      const blob = res.data
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
      addToast(err.message, 'error')
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
              onChange={e => { 
                setCiudadFiltro(e.target.value)
                if (!e.target.value) setCiudadFiltro2('')
                setPage(1) 
              }}
            >
              <option value="">Todas las ciudades</option>
              {ciudadesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {ciudadFiltro && (
            <label className="rep-label" style={{ animation: 'fadeIn 0.2s' }}>
              Comparar con
              <select
                className="rep-select"
                value={ciudadFiltro2}
                onChange={e => { setCiudadFiltro2(e.target.value); setPage(1) }}
              >
                <option value="">Ninguna</option>
                {ciudadesDisponibles.map(c => (c !== ciudadFiltro) && <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

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
                {ciudadFiltro ? (ciudadFiltro2 ? `${ciudadFiltro} vs ${ciudadFiltro2}` : ciudadFiltro) : 'promedio · todas las ciudades'}
              </span>
            </div>
            {loading
              ? <div className="rep-chart-empty">Cargando…</div>
              : <LineChart series={seriesLinea} metrica={metricaGrafico} />
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
                    {formatDateTime(row.fecha)}
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
