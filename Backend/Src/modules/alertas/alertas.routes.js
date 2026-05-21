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
const alertasService = require('./alertas.service')
const logger = require('../../utils/logger')
const { verificarToken } = require('../auth/auth.middleware')
const { validate } = require('../../middleware/validate')
const { alertasQuerySchema, reconocerBodySchema } = require('./alertas.schema')
const { success, error } = require('../../utils/response')

// ─── GET /api/alertas ─────────────────────────────────────────────────────────
router.get('/', validate(alertasQuerySchema, 'query'), async (req, res) => {
  try {
    const { total, rows } = await alertasService.getAlertas(req.query)
    success(res, {
      total,
      pagina:  parseInt(req.query.page) || 1,
      limite:  req.query.limit,
      alertas: rows,
    })
  } catch (err) {
    logger.error('[alertas] GET /api/alertas error:', err)
    error(res, 'Error interno al obtener alertas', 500)
  }
})

// ─── PATCH /api/alertas/:id/reconocer ────────────────────────────────────────
router.patch('/:id/reconocer', verificarToken, validate(reconocerBodySchema, 'body'), async (req, res) => {
  try {
    const id        = parseInt(req.params.id)
    const usuarioId = parseInt(req.body.usuarioId)

    if (!id || !usuarioId) {
      return error(res, 'Se requieren id (path) y usuarioId (body)', 400)
    }

    const ok = await alertasService.reconocerAlerta(id, usuarioId)

    if (!ok) {
      return error(res, 'Alerta no encontrada o ya reconocida', 404)
    }

    success(res, null)
  } catch (err) {
    logger.error('[alertas] PATCH reconocer error:', err)
    error(res, 'Error interno al reconocer alerta', 500)
  }
})

module.exports = router
