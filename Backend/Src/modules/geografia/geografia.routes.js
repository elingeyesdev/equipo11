const router = require('express').Router()
const db = require('../../config/db')

/**
 * GET /api/geografia/localidades
 * Query params opcionales:
 *   - pais_codigo   (ISO 3166-1 alpha-2, ej: "BO", "AR", "US")
 *   - region_id     (UUID o INT de la región)
 *   - bbox          (minLng,minLat,maxLng,maxLat — para optimizar viewport)
 *   - limit         (default 500, max 2000)
 *
 * Retorna coordenadas lat/lng de cada localidad para alimentar Mapbox.
 */
router.get('/localidades', async (req, res) => {
  try {
    const { pais_codigo, region_id, bbox, limit = 500 } = req.query
    const params = []
    const conditions = []

    if (pais_codigo) {
      params.push(pais_codigo.toUpperCase())
      conditions.push(`p.codigo_iso2 = $${params.length}`)
    }
    if (region_id) {
      params.push(region_id)
      conditions.push(`l.region_id = $${params.length}`)
    }
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
      params.push(minLng, minLat, maxLng, maxLat)
      conditions.push(
        `l.longitud BETWEEN $${params.length - 3} AND $${params.length - 1}`,
        `l.latitud  BETWEEN $${params.length - 2} AND $${params.length}`
      )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(Math.min(Number(limit), 2000))

    const sql = `
      SELECT
        l.id,
        l.nombre,
        l.latitud,
        l.longitud,
        r.nombre  AS region,
        p.nombre  AS pais,
        p.codigo_iso2
      FROM localidades l
      JOIN regiones r ON r.id = l.region_id
      JOIN paises   p ON p.id = r.pais_id
      ${where}
      ORDER BY l.nombre
      LIMIT $${params.length}
    `

    const { rows } = await db.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('[geografia] Error:', err)
    res.status(500).json({ error: 'Error al obtener localidades' })
  }
})

module.exports = router
