/**
 * alertas.routes.js
 * -----------------
 * Expone los endpoints HTTP del módulo de alertas.
 *
 * GET  /api/alertas
 *   Query params (todos opcionales):
 *     desde     — ISO 8601 (ej: 2026-04-01T00:00:00Z)
 *     hasta     — ISO 8601
 *     metrica   — clave de métrica (ej: 'temperatura', 'aqi')
 *     severidad — 'advertencia' | 'critica' | 'emergencia'
 *     reconocida — 'true' | 'false'
 *     page      — número de página (default 1)
 *     limit     — registros por página (default 20, máx 100)
 *   Retorna: { total, pagina, limite, alertas: [...] }
 *
 * PATCH /api/alertas/:id/reconocer
 *   Body: { usuarioId }
 *   Retorna: { ok: true } | 404
 */

const router = require('express').Router()
const db = require('../../config/db')
const alertasService = require('./alertas.service')

// ─── GET /api/alertas ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      desde,
      hasta,
      metrica,
      severidad,
      reconocida,
      page  = 1,
      limit = 20,
    } = req.query

    const limitNum = Math.min(parseInt(limit) || 20, 100)
    const offset   = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum

    // Construcción dinámica del WHERE
    const conditions = []
    const params     = []
    let idx = 1

    if (desde) {
      conditions.push(`a.tiempo >= $${idx++}`)
      params.push(desde)
    }
    if (hasta) {
      conditions.push(`a.tiempo <= $${idx++}`)
      params.push(hasta)
    }
    if (metrica) {
      conditions.push(`m.clave = $${idx++}`)
      params.push(metrica)
    }
    if (severidad) {
      conditions.push(`u.severidad = $${idx++}`)
      params.push(severidad)
    }
    if (reconocida !== undefined) {
      conditions.push(`a.reconocida = $${idx++}`)
      params.push(reconocida === 'true')
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // Total para paginación
    const countSql = `
      SELECT COUNT(*) AS total
      FROM alertas a
      JOIN localidades l ON l.id = a.localidad_id
      JOIN metricas m    ON m.id = a.metrica_id
      JOIN umbrales u    ON u.id = a.umbral_id
      ${where}
    `
    const { rows: countRows } = await db.query(countSql, params)
    const total = parseInt(countRows[0].total)

    // Datos paginados
    const dataSql = `
      SELECT
        a.id,
        a.tiempo,
        l.nombre           AS ciudad,
        m.clave            AS metrica,
        m.nombre           AS metrica_nombre,
        un.simbolo         AS unidad,
        a.valor,
        u.label,
        u.severidad,
        u.color_hex,
        a.reconocida,
        a.reconocida_en,
        ur.nombre          AS reconocida_por
      FROM alertas a
      JOIN localidades l  ON l.id = a.localidad_id
      JOIN metricas m     ON m.id = a.metrica_id
      JOIN umbrales u     ON u.id = a.umbral_id
      JOIN unidades un    ON un.id = m.unidad_base_id
      LEFT JOIN usuarios ur ON ur.id = a.reconocida_por
      ${where}
      ORDER BY a.tiempo DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `
    const { rows } = await db.query(dataSql, [...params, limitNum, offset])

    res.json({
      total,
      pagina:  parseInt(page) || 1,
      limite:  limitNum,
      alertas: rows,
    })
  } catch (err) {
    console.error('[alertas] GET /api/alertas error:', err)
    res.status(500).json({ error: 'Error interno al obtener alertas' })
  }
})

// ─── PATCH /api/alertas/:id/reconocer ────────────────────────────────────────
router.patch('/:id/reconocer', async (req, res) => {
  try {
    const id        = parseInt(req.params.id)
    const usuarioId = parseInt(req.body.usuarioId)

    if (!id || !usuarioId) {
      return res.status(400).json({ error: 'Se requieren id (path) y usuarioId (body)' })
    }

    const ok = await alertasService.reconocerAlerta(id, usuarioId)

    if (!ok) {
      return res.status(404).json({ error: 'Alerta no encontrada o ya reconocida' })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[alertas] PATCH reconocer error:', err)
    res.status(500).json({ error: 'Error interno al reconocer alerta' })
  }
})

module.exports = router
