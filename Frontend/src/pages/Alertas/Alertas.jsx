/**
 * Alertas.jsx — Página de historial y gestión de alertas ambientales.
 *
 * Funcionalidades:
 *  - Filtros: rango de fechas, métrica, severidad, estado (reconocida)
 *  - Tabla paginada con columnas: Fecha | Ciudad | Métrica | Valor | Nivel | Severidad | Estado
 *  - Botón "Reconocer" en filas pendientes (PATCH /api/alertas/:id/reconocer)
 *  - Badge de color por severidad
 *  - Paginación simple (anterior / siguiente)
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '../../components/Toast/Toast'
import { formatDateTime } from '../../utils/formatters'
import httpClient from '../../config/httpClient'
import { usePwa } from '../../context/PwaContext'
import './Alertas.css'
import '../PagePlaceholder.css'

const METRICAS = [
  { value: '',            label: 'Todas las métricas' },
  { value: 'temperatura', label: 'Temperatura' },
  { value: 'aqi',         label: 'Calidad del Aire (AQI)' },
  { value: 'ica',         label: 'Calidad del Agua (ICA)' },
  { value: 'ruido',       label: 'Ruido Ambiental' },
  { value: 'humedad',     label: 'Humedad' },
]

const SEVERIDADES = [
  { value: '',            label: 'Todas las severidades' },
  { value: 'advertencia', label: 'Advertencia' },
  { value: 'critica',     label: 'Crítica' },
  { value: 'emergencia',  label: 'Emergencia' },
]

export default function Alertas() {
  const { addToast } = useToast()
  const { isOnline } = usePwa()
  
  // ─── Lógica Pull-to-refresh ───────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef(null)
  const touchStartY = useRef(0)

  // ─── Filtros ──────────────────────────────────────────────────────────────
  const [desde,     setDesde]     = useState('')
  const [hasta,     setHasta]     = useState('')
  const [metrica,   setMetrica]   = useState('')
  const [severidad, setSeveridad] = useState('')
  const [soloNoReconocidas, setSoloNoReconocidas] = useState(false)
  const [page, setPage] = useState(1)

  // ─── Datos ────────────────────────────────────────────────────────────────
  const [alertas, setAlertas]     = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const LIMIT = 15

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchAlertas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, limit: LIMIT }
      if (desde)     params.desde = new Date(desde).toISOString()
      if (hasta)     params.hasta = new Date(hasta + 'T23:59:59').toISOString()
      if (metrica)   params.metrica = metrica
      if (severidad) params.severidad = severidad
      if (soloNoReconocidas) params.reconocida = 'false'

      const res = await httpClient.get('/alertas', { 
        params,
        cacheTTL: isOnline ? 30000 : undefined 
      })
      const data = res.data.data
      setAlertas(data.alertas)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [desde, hasta, metrica, severidad, soloNoReconocidas, page, isOnline])

  // Re-fetch cuando cambian filtros o página
  useEffect(() => { fetchAlertas() }, [fetchAlertas])

  // Resetear página cuando cambian filtros
  useEffect(() => { setPage(1) }, [desde, hasta, metrica, severidad, soloNoReconocidas])

  // ─── Reconocer alerta ─────────────────────────────────────────────────────
  async function reconocer(id) {
    try {
      // usuarioId 1 por defecto (sin auth completa en MVP)
      await httpClient.patch(`/alertas/${id}/reconocer`, { usuarioId: 1 })
      // Actualizar solo esa fila en memoria (sin refetch completo)
      setAlertas(prev => prev.map(a =>
        a.id === id ? { ...a, reconocida: true, reconocida_en: new Date().toISOString() } : a
      ))
    } catch (err) {
      addToast('No se pudo reconocer la alerta: ' + err.message, 'error')
    }
  }

  const totalPaginas = Math.ceil(total / LIMIT)

  // Handlers para Pull-to-refresh
  const handleTouchStart = (e) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === 0) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY.current;

    if (distance > 80 && !refreshing && !loading) {
      setRefreshing(true);
      fetchAlertas();
    }
  };

  return (
    <div 
      className="page alertas-page overflow-y-auto w-full max-w-7xl mx-auto p-6 md:p-10" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {refreshing && (
        <div className="flex justify-center items-center py-2 bg-teal-900 text-teal-100 text-sm font-bold transition-all animate-bounce">
          <span>Actualizando datos...</span>
        </div>
      )}
      {/* ─── Cabecera ──────────────────────────────────────────────────── */}
      <div className="page-header mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Historial de <span className="text-[var(--accent)]">Alertas</span></h1>
          <p className="text-base text-[var(--text-secondary)] mb-8">
            Consulta, filtra y reconoce las alertas generadas automáticamente por el sistema de simulación.
          </p>
        </div>
        <span className="page-tag">
          {total} registro{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ─── Filtros ───────────────────────────────────────────────────── */}
      <div className="alertas-filtros">
        <div className="alertas-filtros-fila">
          <label className="alertas-label">
            Desde
            <input
              type="date"
              className="alertas-input"
              value={desde}
              onChange={e => setDesde(e.target.value)}
            />
          </label>

          <label className="alertas-label">
            Hasta
            <input
              type="date"
              className="alertas-input"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
            />
          </label>

          <label className="alertas-label">
            Métrica
            <select
              className="alertas-select"
              value={metrica}
              onChange={e => setMetrica(e.target.value)}
            >
              {METRICAS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="alertas-label">
            Severidad
            <select
              className="alertas-select"
              value={severidad}
              onChange={e => setSeveridad(e.target.value)}
            >
              {SEVERIDADES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="alertas-checkbox-label">
            <input
              type="checkbox"
              checked={soloNoReconocidas}
              onChange={e => setSoloNoReconocidas(e.target.checked)}
            />
            Solo no reconocidas
          </label>
        </div>
      </div>

      {/* ─── Tabla ─────────────────────────────────────────────────────── */}
      <div className="alertas-tabla-wrap">
        {loading && (
          <div className="alertas-estado">Cargando alertas…</div>
        )}
        {error && !loading && (
          <div className="alertas-estado alertas-estado--error">
            Error al cargar alertas: {error}
          </div>
        )}
        {!loading && !error && alertas.length === 0 && (
          <div className="alertas-estado">
            No se encontraron alertas con los filtros seleccionados.
          </div>
        )}

        {!loading && alertas.length > 0 && (
          <table className="alertas-tabla">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Ciudad</th>
                <th>Métrica</th>
                <th>Valor</th>
                <th>Nivel</th>
                <th>Severidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map(a => (
                <tr key={a.id} className={a.reconocida ? 'alertas-fila--reconocida' : ''}>
                  <td className="alertas-td-fecha">{formatDateTime(a.tiempo)}</td>
                  <td className="alertas-td-ciudad">{a.ciudad}</td>
                  <td className="alertas-td-metrica">{a.metrica_nombre}</td>
                  <td className="alertas-td-valor">
                    {a.valor} <span className="alertas-unidad">{a.unidad}</span>
                  </td>
                  <td className="alertas-td-label">{a.label}</td>
                  <td>
                    <span className={`alertas-badge alertas-badge--${a.severidad}`}>
                      {a.severidad}
                    </span>
                  </td>
                  <td>
                    {a.reconocida ? (
                      <span className="alertas-reconocida-txt">
                        <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Reconocida
                      </span>
                    ) : (
                      <button
                        className="alertas-btn-reconocer"
                        onClick={() => reconocer(a.id)}
                      >
                        Reconocer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Paginación ────────────────────────────────────────────────── */}
      {totalPaginas > 1 && (
        <div className="alertas-paginacion">
          <button
            className="alertas-pag-btn"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Anterior
          </button>
          <span className="alertas-pag-info">
            Página {page} de {totalPaginas}
          </span>
          <button
            className="alertas-pag-btn"
            disabled={page >= totalPaginas}
            onClick={() => setPage(p => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
