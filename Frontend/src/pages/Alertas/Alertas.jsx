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
import { useState, useEffect, useCallback } from 'react'
import './Alertas.css'
import '../PagePlaceholder.css'

const API_BASE = 'http://localhost:3000/api'

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

// Formatear fecha ISO a string legible
function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Alertas() {
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
      const params = new URLSearchParams({ page, limit: LIMIT })
      if (desde)     params.set('desde', new Date(desde).toISOString())
      if (hasta)     params.set('hasta', new Date(hasta + 'T23:59:59').toISOString())
      if (metrica)   params.set('metrica', metrica)
      if (severidad) params.set('severidad', severidad)
      if (soloNoReconocidas) params.set('reconocida', 'false')

      const res = await fetch(`${API_BASE}/alertas?${params}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setAlertas(data.alertas)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, metrica, severidad, soloNoReconocidas, page])

  // Re-fetch cuando cambian filtros o página
  useEffect(() => { fetchAlertas() }, [fetchAlertas])

  // Resetear página cuando cambian filtros
  useEffect(() => { setPage(1) }, [desde, hasta, metrica, severidad, soloNoReconocidas])

  // ─── Reconocer alerta ─────────────────────────────────────────────────────
  async function reconocer(id) {
    try {
      // usuarioId 1 por defecto (sin auth completa en MVP)
      const res = await fetch(`${API_BASE}/alertas/${id}/reconocer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: 1 }),
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      // Actualizar solo esa fila en memoria (sin refetch completo)
      setAlertas(prev => prev.map(a =>
        a.id === id ? { ...a, reconocida: true, reconocida_en: new Date().toISOString() } : a
      ))
    } catch (err) {
      alert('No se pudo reconocer la alerta: ' + err.message)
    }
  }

  const totalPaginas = Math.ceil(total / LIMIT)

  return (
    <div className="page alertas-page">
      {/* ─── Cabecera ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Módulo de Alertas</p>
          <h1 className="page-heading">Historial de <em>Alertas</em></h1>
          <p className="page-desc">
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
                  <td className="alertas-td-fecha">{fmtFecha(a.tiempo)}</td>
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
                        ✓ Reconocida
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
