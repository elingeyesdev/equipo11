const db = require('../../config/db')
const logger = require('../../utils/logger')
const { success, error } = require('../../utils/response')

const historialController = {
  /**
   * GET /api/historial/ciudad/:localidadId?horas=24
   * Devuelve el historial horario de una ciudad específica.
   * Agrupa por hora para reducir el volumen de datos al cliente.
   */
  getCiudadHistorial: async (req, res) => {
    try {
      const { localidadId } = req.params
      const horas = parseInt(req.query.horas) || 24

      const { rows } = await db.query(`
        SELECT
          date_trunc('hour', l.tiempo)    AS hora,
          m.clave                         AS metrica,
          ROUND(AVG(l.valor)::numeric, 2) AS valor
        FROM lecturas l
        JOIN metricas m ON m.id = l.metrica_id
        WHERE l.localidad_id = $1
          AND l.tiempo >= NOW() - ($2 || ' hours')::interval
        GROUP BY hora, m.clave
        ORDER BY hora ASC
      `, [localidadId, horas])

      // Agrupar por hora → [{ timestamp, data: { aqi, temperatura, ... } }]
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
      const { rows } = await db.query(`
        SELECT
          date_trunc('second', l.tiempo)  AS ts,
          loc.id                          AS localidad_id,
          loc.nombre                      AS ciudad,
          loc.latitud,
          loc.longitud,
          m.clave                         AS metrica,
          l.valor
        FROM lecturas l
        JOIN localidades loc ON loc.id = l.localidad_id
        JOIN metricas    m   ON m.id   = l.metrica_id
        ORDER BY ts ASC, loc.id
      `)

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
      const { rows: localidades } = await db.query('SELECT id, nombre FROM localidades')
      const { rows: metricas }    = await db.query('SELECT id, clave FROM metricas')
      const { rows: fuentes }     = await db.query("SELECT id FROM fuentes_datos WHERE clave = 'simulacion'")

      if (!fuentes.length) {
        return error(res, 'Fuente de datos "simulacion" no encontrada en la BD', 400)
      }

      const fuenteId = fuentes[0].id
      const now = Date.now()
      const inserts = []

      for (let i = 24; i >= 0; i--) {
        const tiempo = new Date(now - i * 60 * 60 * 1000).toISOString()
        for (const loc of localidades) {
          for (const met of metricas) {
            inserts.push(`('${tiempo}', ${loc.id}, ${met.id}, ${(Math.random() * 100).toFixed(2)}, ${fuenteId})`)
          }
        }
      }

      await db.query(`
        INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
        VALUES ${inserts.join(',')}
        ON CONFLICT DO NOTHING
      `)

      success(res, { mensaje: 'Datos de prueba inyectados (24 horas)', count: inserts.length })
    } catch (err) {
      logger.error('[historial] seed error:', err)
      error(res, 'Error en seeding: ' + err.message, 500)
    }
  },

  clearHistorial: async (req, res) => {
    try {
      await db.query('DELETE FROM lecturas')
      success(res, { mensaje: 'Todo el historial ha sido borrado exitosamente.' })
    } catch (err) {
      logger.error('[historial] clear error:', err)
      error(res, 'Error limpiando base de datos: ' + err.message, 500)
    }
  }
}

module.exports = historialController
