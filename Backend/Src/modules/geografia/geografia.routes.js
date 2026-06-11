const router = require('express').Router()
const logger = require('../../utils/logger')
const { success, error } = require('../../utils/response')
const { getLocalidades, getRegionesGeoJSON } = require('./geografia.service')

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
    const rows = await getLocalidades(req.query)
    success(res, rows)
  } catch (err) {
    logger.error('[geografia] Error:', err)
    error(res, 'Error al obtener localidades', 500)
  }
})

/**
 * GET /api/geografia/regiones-geojson
 *
 * Devuelve un FeatureCollection de GeoJSON con los polígonos de todas las
 * regiones (ADM1) que tengan geometría definida en la base de datos.
 *
 * Cada Feature contiene:
 *   - geometry: polígono/multipolígono de la región (desde la columna geojson)
 *   - properties: { id, nombre, pais_codigo, nivel }
 */
router.get('/regiones-geojson', async (req, res) => {
  try {
    const features = await getRegionesGeoJSON()
    success(res, {
      type: 'FeatureCollection',
      features,
    })
  } catch (err) {
    logger.error('[geografia] Error en /regiones-geojson:', err)
    error(res, 'Error al obtener regiones GeoJSON', 500)
  }
})

module.exports = router
