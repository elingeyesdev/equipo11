const logger = require('../../utils/logger')
const { success, error } = require('../../utils/response')
const { getCiudadHistorial, getHistorial, seedHistorial, clearHistorial } = require('./historial.service')

const historialController = {
  getCiudadHistorial: async (req, res) => {
    try {
      const { localidadId } = req.params
      const horas = parseInt(req.query.horas) || 24

      const rows = await getCiudadHistorial(localidadId, horas)

      const horaMap = new Map()
      for (const r of rows) {
        const key = r.hora.toISOString()
        if (!horaMap.has(key)) horaMap.set(key, { timestamp: key, data: {} })
        horaMap.get(key).data[r.metrica] = Number(r.valor)
      }

      success(res, [...horaMap.values()])
    } catch (err) {
      logger.error('[historial/ciudad] error:', err)
      error(res, 'Error obteniendo historial de ciudad: ' + err.message, 500)
    }
  },

  getHistorial: async (req, res) => {
    try {
      const rows = await getHistorial()

      const groups = new Map()
      for (const r of rows) {
        const key = r.ts.toISOString()
        if (!groups.has(key)) groups.set(key, { timestamp: key, cities: new Map() })
        const g = groups.get(key)
        if (!g.cities.has(r.localidad_id)) {
          g.cities.set(r.localidad_id, {
            id: String(r.localidad_id),
            name: r.ciudad,
            latitude:  Number(r.latitud),
            longitude: Number(r.longitud),
            data: {}
          })
        }
        g.cities.get(r.localidad_id).data[r.metrica] = Number(r.valor)
      }

      const timeline = [...groups.values()].map(g => ({
        timestamp: g.timestamp,
        cities: [...g.cities.values()]
      }))

      success(res, timeline)
    } catch (err) {
      logger.error('[historial] error:', err)
      error(res, 'Error obteniendo historial: ' + err.message, 500)
    }
  },

  seedHistorial: async (req, res) => {
    try {
      const count = await seedHistorial()
      success(res, { mensaje: 'Datos de prueba inyectados (24 horas)', count })
    } catch (err) {
      logger.error('[historial] seed error:', err)
      error(res, 'Error en seeding: ' + err.message, 500)
    }
  },

  clearHistorial: async (req, res) => {
    try {
      await clearHistorial()
      success(res, { mensaje: 'Todo el historial ha sido borrado exitosamente.' })
    } catch (err) {
      logger.error('[historial] clear error:', err)
      error(res, 'Error limpiando base de datos: ' + err.message, 500)
    }
  }
}

module.exports = historialController
