const { success, error } = require('../../utils/response')
const logger = require('../../utils/logger')
const iaService = require('./ia.service')

async function analizarClima(req, res) {
  try {
    const { ciudad, lat, lon } = req.body

    if (!ciudad || !lat || !lon) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros: ciudad, lat, lon' })
    }

    const analisis = await iaService.generarAnalisisClima(ciudad, lat, lon)
    return success(res, { analisis })
  } catch (err) {
    logger.error(`[ia.controller] Error en analizarClima:`, err)
    return res.status(500).json({ ok: false, error: 'Error interno del servidor al generar el análisis IA' })
  }
}

module.exports = {
  analizarClima
}
