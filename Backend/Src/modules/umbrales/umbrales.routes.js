const router = require('express').Router()
const db = require('../../config/db')

/**
 * GET /api/umbrales
 * Retorna umbrales de todas las métricas agrupados.
 *
 * GET /api/umbrales/:metrica
 * Retorna umbrales de una métrica específica (ej: "aqi", "temperatura").
 * Ordenados por nivel ascendente.
 */

async function getUmbrales(req, res) {
  try {
    const metrica = req.params.metrica

    const sql = metrica
      ? `SELECT
           u.nivel,
           u.label,
           u.valor_min,
           u.valor_max,
           u.color_hex,
           u.severidad,
           m.clave   AS metrica,
           m.nombre  AS metrica_nombre,
           un.simbolo AS unidad
         FROM umbrales u
         JOIN metricas m  ON m.id = u.metrica_id
         LEFT JOIN metrica_unidades mu ON mu.metrica_id = m.id AND mu.es_principal = TRUE
         LEFT JOIN unidades un         ON un.id = mu.unidad_id
         WHERE m.clave = $1
         ORDER BY u.nivel ASC`
      : `SELECT
           u.nivel,
           u.label,
           u.valor_min,
           u.valor_max,
           u.color_hex,
           u.severidad,
           m.clave   AS metrica,
           m.nombre  AS metrica_nombre,
           un.simbolo AS unidad
         FROM umbrales u
         JOIN metricas m  ON m.id = u.metrica_id
         LEFT JOIN metrica_unidades mu ON mu.metrica_id = m.id AND mu.es_principal = TRUE
         LEFT JOIN unidades un         ON un.id = mu.unidad_id
         ORDER BY m.clave, u.nivel ASC`

    const { rows } = await db.query(sql, metrica ? [metrica] : [])

    if (metrica && rows.length === 0) {
      return res.status(404).json({ error: `Métrica '${metrica}' no encontrada` })
    }

    res.json(rows)
  } catch (err) {
    console.error('[umbrales] Error:', err)
    res.status(500).json({ error: 'Error interno al obtener umbrales' })
  }
}

router.get('/', getUmbrales)
router.get('/:metrica', getUmbrales)

module.exports = router
