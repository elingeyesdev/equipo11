import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useUnidades } from '../../hooks/useUnidades'
import { formatearValor } from '../../utils/unidades'
import { useToast } from '../../components/Toast/Toast'
import { formatDateTime, formatCityName } from '../../utils/formatters'
import { useZonaSim } from '../../context/ZonaSimContext'
import httpClient from '../../config/httpClient'
import { getSensoresIoT } from '../../utils/weatherApi'
import LineChart from './LineChart'
import BarChart from './BarChart'
import KpiCard from './KpiCard'
import AtmosfericoTab from './AtmosfericoTab'
import { CIUDADES, METRICAS_OPTS, RANGOS, PAGE_SIZE, calcStats } from './constants'
import './Reportes.css'
import '../PagePlaceholder.css'

export default function Reportes() {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('historial')
  const [historial, setHistorial] = useState([])
  const [sensores, setSensores] = useState([])
  const [loading, setLoading] = useState(true)
  const [ciudadFiltro, setCiudadFiltro] = useState('')
  const [ciudadFiltro2, setCiudadFiltro2] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [metricaGrafico, setMetricaGrafico] = useState('temperatura')
  const [page, setPage] = useState(1)
  const { unidades } = useUnidades()

  // ─── Zona sim context: auto-refresh cuando termina una simulación ───
  const { zonaSimActiva } = useZonaSim()
  const prevActivaRef = useRef(zonaSimActiva)

  const fetchHistorial = useCallback(() => {
    console.log('🔄 [Reportes] Solicitando historial fresco al servidor...');
    setLoading(true)
    httpClient.get('/historial', { 
      cacheTTL: false,
      params: { _t: Date.now() }, // Cache buster absoluto
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(res => res.data.data)
      .then(data => {
        const flat = []
        data.forEach(t => {
          t.cities.forEach(c => {
            flat.push({
              fecha: t.timestamp,
              ciudad: c.name,
              temperatura: c.data.temperatura,
              aqi: c.data.aqi,
              humedad: c.data.humedad,
              ruido: c.data.ruido,
              ica: c.data.ica,
            })
          })
        })
        console.log(`✅ [Reportes] Historial cargado. Total ciudades en historial:`, new Set(flat.map(x => x.ciudad)).size);
        setHistorial(flat.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
      })
      .catch((err) => {
        console.error('❌ [Reportes] Error cargando historial:', err);
        addToast('Error cargando historial', 'error');
      })
      .finally(() => setLoading(false))
  }, [addToast])

  // Carga inicial al montar el componente
  useEffect(() => { fetchHistorial() }, [fetchHistorial])

  // Fetch sensores IoT para obtener wind_speed
  useEffect(() => {
    getSensoresIoT().then(data => {
      if (data && data.length > 0) setSensores(data);
    });
  }, []);

  // Derivar lluvia estimada (mm/h) desde weather_code WMO
  const weatherCodeToRain = (code) => {
    if (code == null) return null;
    if (code >= 61 && code <= 65) return 2.5 + (code - 61) * 2.5; // rain: 2.5-10 mm/h
    if (code >= 80 && code <= 82) return 2 + (code - 80) * 3;     // showers: 2-8 mm/h
    if (code >= 51 && code <= 55) return 0.3 + (code - 51) * 0.2; // drizzle: 0.3-1.1 mm/h
    if (code === 56 || code === 57) return 0.4;                    // freezing drizzle
    if (code === 66 || code === 67) return 3;                      // freezing rain
    if (code >= 95 && code <= 99) return 6;                        // thunderstorm
    return 0;
  };

  // Merge wind_speed y rain de sensores en el historial
  const sensorExtrasPorCiudad = useMemo(() => {
    const map = {};
    sensores.forEach(s => {
      if (!s.name) return;
      const key = s.name.toLowerCase();
      map[key] = {
        windSpeed: s.wind_speed != null ? s.wind_speed : null,
        rain: weatherCodeToRain(s.weather_code),
      };
    });
    return map;
  }, [sensores]);

  const historialConViento = useMemo(() =>
    historial.map(row => {
      const extra = sensorExtrasPorCiudad[row.ciudad.toLowerCase()];
      return {
        ...row,
        windSpeed: extra?.windSpeed ?? null,
        rain: extra?.rain ?? null,
      };
    }),
    [historial, sensorExtrasPorCiudad]
  );

  // Auto-refresh cuando una simulación de zona termina (activa pasa de true→false)
  useEffect(() => {
    if (prevActivaRef.current === true && zonaSimActiva === false) {
      // Pequeño delay para que la BD termine de escribir
      const timer = setTimeout(() => {
        fetchHistorial()
        addToast('Datos de simulación actualizados', 'success')
      }, 1500)
      return () => clearTimeout(timer)
    }
    prevActivaRef.current = zonaSimActiva
  }, [zonaSimActiva, fetchHistorial, addToast])

  const ciudadesDisponibles = useMemo(() => {
    const s = new Set(CIUDADES)
    historial.forEach(d => s.add(d.ciudad))
    return Array.from(s).sort((a, b) => formatCityName(a).localeCompare(formatCityName(b)))
  }, [historial])

  const aplicarRango = dias => {
    if (dias === null) {
      setFechaInicio('')
      setFechaFin('')
    } else {
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - dias)
      setFechaInicio(from.toISOString().split('T')[0])
      setFechaFin(now.toISOString().split('T')[0])
    }
    setPage(1)
  }

  const datosFiltrados = useMemo(() =>
    historialConViento.filter(row => {
      const esSimulacion = row.ciudad.startsWith('Zona Sim.');
      const esSimulacionSeleccionada = esSimulacion && (row.ciudad === ciudadFiltro || row.ciudad === ciudadFiltro2);

      if (ciudadFiltro || ciudadFiltro2) {
        if (row.ciudad !== ciudadFiltro && row.ciudad !== ciudadFiltro2) return false
      }
      if (!esSimulacionSeleccionada) {
        if (fechaInicio && new Date(row.fecha) < new Date(fechaInicio)) return false
        if (fechaFin && new Date(row.fecha) > new Date(fechaFin + 'T23:59:59')) return false
      }
      return true
    }),
    [historialConViento, ciudadFiltro, ciudadFiltro2, fechaInicio, fechaFin]
  )

  const metricaActual = METRICAS_OPTS.find(m => m.value === metricaGrafico) ?? METRICAS_OPTS[0]

  const seriesLinea = useMemo(() => {
    const s = []
    if (ciudadFiltro) {
      s.push({
        name: formatCityName(ciudadFiltro),
        datos: datosFiltrados.filter(d => d.ciudad === ciudadFiltro),
        colorVar: metricaActual.color
      })
    }
    if (ciudadFiltro2) {
      s.push({
        name: formatCityName(ciudadFiltro2),
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
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      s.push({ name: 'Promedio general', datos: prom, colorVar: metricaActual.color })
    }
    return s
  }, [datosFiltrados, ciudadFiltro, ciudadFiltro2, metricaActual, metricaGrafico])

  const stats = useMemo(() => ({
    temperatura: calcStats(datosFiltrados, 'temperatura'),
    aqi: calcStats(datosFiltrados, 'aqi'),
    humedad: calcStats(datosFiltrados, 'humedad'),
    ruido: calcStats(datosFiltrados, 'ruido'),
    windSpeed: calcStats(datosFiltrados, 'windSpeed'),
    rain: calcStats(datosFiltrados, 'rain'),
  }), [datosFiltrados])

  const totalPaginas = Math.ceil(datosFiltrados.length / PAGE_SIZE)
  const datosPagina = datosFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const descargarReporte = async formato => {
    const getReportFilename = (c1, c2) => {
      const cleanName = (name) => {
        if (!name) return '';
        // Quitar "Zona Sim. "
        let clean = name.replace(/Zona Sim\.\s*/i, '');
        // Quitar números
        clean = clean.replace(/\d+/g, '').trim();

        // Normalizar a minúsculas y caracteres ascii simples
        clean = clean.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z\s]/g, '')
          .trim();

        const hasDept = clean.includes('department') || clean.includes('departamento');
        if (hasDept) {
          clean = clean.replace(/department|departamento/g, '').trim();
          clean = clean.replace(/\s+/g, '_');
          return `department_${clean}`;
        }

        return clean.replace(/\s+/g, '_');
      };

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const dateStr = `${dd}${mm}${yyyy}`;

      if (c1 && c2) {
        return `${cleanName(c1)}_${cleanName(c2)}_${dateStr}`;
      } else if (c1) {
        return `${cleanName(c1)}_${dateStr}`;
      } else {
        return `reporte_ambiental_${dateStr}`;
      }
    };

    try {
      const payload = {
        formato,
        titulo: `Reporte Ambiental${ciudadFiltro ? (ciudadFiltro2 ? ` — ${formatCityName(ciudadFiltro)} vs ${formatCityName(ciudadFiltro2)}` : ` — ${formatCityName(ciudadFiltro)}`) : ' — Todas las ciudades'}`,
        columnas: [
          { header: 'Fecha y Hora', key: 'fechaFmt' },
          { header: 'Ciudad', key: 'ciudad' },
          { header: 'Temp (°C)', key: 'temperaturaFmt' },
          { header: 'AQI', key: 'aqiFmt' },
          { header: 'Humedad (%)', key: 'humedadFmt' },
          { header: 'Ruido (dB)', key: 'ruidoFmt' },
          { header: 'ICA', key: 'icaFmt' },
          { header: 'Viento (km/h)', key: 'windSpeedFmt' },
          { header: 'Lluvia (mm/h)', key: 'rainFmt' },
        ],
        datos: datosFiltrados.map(d => ({
          fechaFmt: formatDateTime(d.fecha),
          ciudad: formatCityName(d.ciudad),
          temperaturaFmt: formatearValor('temperatura', d.temperatura, unidades.temperatura),
          aqiFmt: formatearValor('aqi', d.aqi, unidades.aqi),
          humedadFmt: formatearValor('humedad', d.humedad, unidades.humedad),
          ruidoFmt: formatearValor('ruido', d.ruido, unidades.ruido),
          icaFmt: d.ica != null ? `${Number(d.ica).toFixed(0)} ICA` : '—',
          windSpeedFmt: d.windSpeed != null ? `${Number(d.windSpeed).toFixed(1)} km/h` : '—',
          rainFmt: d.rain != null ? `${Number(d.rain).toFixed(2)} mm/h` : '—',
        })),
      }

      const res = await httpClient.post('/reportes/generar', payload, { responseType: 'blob' })
      const blob = res.data
      const url = URL.createObjectURL(blob)
      const filename = `${getReportFilename(ciudadFiltro, ciudadFiltro2)}.${formato === 'excel' ? 'xlsx' : 'pdf'}`

      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: filename,
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
      </div>

      {/* ─── Tabs ───────────────────────────────────────────── */}
      <div className="rep-tabs">
        <button
          className={`rep-tab ${activeTab === 'historial' ? 'rep-tab--active' : ''}`}
          onClick={() => setActiveTab('historial')}
        >
          📂 Historial de Lecturas
        </button>
        <button
          className={`rep-tab ${activeTab === 'atmosferico' ? 'rep-tab--active' : ''}`}
          onClick={() => setActiveTab('atmosferico')}
        >
          🌦️ Mapa Atmosférico
        </button>
      </div>

      {activeTab === 'historial' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', justifyContent: 'flex-end' }}>
            {zonaSimActiva && (
              <span className="page-tag" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', borderColor: 'rgba(251, 146, 60, 0.3)' }}>
                ⏳ Simulación en curso…
              </span>
            )}
            <button
              className="rep-rango-btn"
              onClick={fetchHistorial}
              disabled={loading}
              title="Recargar datos del historial"
              style={{ padding: '6px 14px', fontSize: '13px', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? '⏳' : '🔄'} Actualizar
            </button>
            <span className="page-tag">{datosFiltrados.length} registros</span>
          </div>

          {/* ─── KPI Cards ──────────────────────────────────────── */}
          <div className="rep-kpi-grid">
            <KpiCard label="Temperatura" sufijo="°C" colorVar="violet" icon="🌡" stats={stats.temperatura} />
            <KpiCard label="Calidad del Aire" sufijo=" AQI" colorVar="rust" icon="🌫" stats={stats.aqi} />
            <KpiCard label="Humedad" sufijo="%" colorVar="river" icon="💧" stats={stats.humedad} />
            <KpiCard label="Ruido" sufijo=" dB" colorVar="amber" icon="🔊" stats={stats.ruido} />
            <KpiCard label="Viento" sufijo=" km/h" colorVar="moss" icon="🌬" stats={stats.windSpeed} />
            <KpiCard label="Lluvia" sufijo=" mm/h" colorVar="climate" icon="🌧" stats={stats.rain} />
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
                  {ciudadesDisponibles.map(c => <option key={c} value={c}>{formatCityName(c)}</option>)}
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
                    {ciudadesDisponibles.map(c => (c !== ciudadFiltro) && <option key={c} value={c}>{formatCityName(c)}</option>)}
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  PDF
                </button>
                <button className="rep-export-btn rep-export-xl" onClick={() => descargarReporte('excel')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M3 15h18M9 3v18" />
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
                    {ciudadFiltro ? (ciudadFiltro2 ? `${formatCityName(ciudadFiltro)} vs ${formatCityName(ciudadFiltro2)}` : formatCityName(ciudadFiltro)) : 'promedio · todas las ciudades'}
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
                    <th>Viento</th>
                    <th>Lluvia</th>
                  </tr>
                </thead>
                <tbody>
                  {datosPagina.map((row, i) => (
                    <tr key={i}>
                      <td className="rep-td-fecha">
                        {formatDateTime(row.fecha)}
                      </td>
                      <td className="rep-td-ciudad">{formatCityName(row.ciudad)}</td>
                      <td className="rep-td-valor">{formatearValor('temperatura', row.temperatura, unidades.temperatura)}</td>
                      <td className="rep-td-valor">{formatearValor('aqi', row.aqi, unidades.aqi)}</td>
                      <td className="rep-td-valor">{formatearValor('humedad', row.humedad, unidades.humedad)}</td>
                      <td className="rep-td-valor">{formatearValor('ruido', row.ruido, unidades.ruido)}</td>
                      <td className="rep-td-valor">
                        {row.ica != null ? `${Number(row.ica).toFixed(0)} ICA` : '—'}
                      </td>
                      <td className="rep-td-valor">
                        {row.windSpeed != null ? `${Number(row.windSpeed).toFixed(1)} km/h` : '—'}
                      </td>
                      <td className="rep-td-valor">
                        {row.rain != null ? `${Number(row.rain).toFixed(2)} mm/h` : '—'}
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
        </>
      ) : (
        <AtmosfericoTab />
      )}
    </div>
  )
}
