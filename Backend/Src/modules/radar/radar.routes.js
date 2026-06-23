/**
 * Radar Routes
 *
 * GET /api/radar/forecast?lat=...&lon=...
 * Returns 96-hour forecast data from Open-Meteo for the given coordinates.
 */

const { Router } = require('express')
const { fetchForecast } = require('./radar.service')
const { success, error } = require('../../utils/response')
const logger = require('../../utils/logger')

const router = Router()

/**
 * GET /forecast?lat=<number>&lon=<number>
 *
 * Response: { ok: true, data: { status: 'ready', data: [...] } }
 * Each item: { forecast_time, temperatura, rain, wind_speed, vis }
 */
router.get('/forecast', async (req, res) => {
  try {
    const { lat, lon } = req.query

    if (lat == null || lon == null) {
      return error(res, 'Se requieren los parámetros lat y lon', 400)
    }

    const latNum = parseFloat(lat)
    const lonNum = parseFloat(lon)

    if (isNaN(latNum) || isNaN(lonNum)) {
      return error(res, 'lat y lon deben ser números válidos', 400)
    }

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return error(res, 'Coordenadas fuera de rango', 400)
    }

    const data = await fetchForecast(latNum, lonNum)

    return success(res, { status: 'ready', data })
  } catch (err) {
    logger.error({ err }, '[radar] Error fetching forecast')
    return error(res, err.message || 'Error al obtener pronóstico', 500)
  }
})

module.exports = router
