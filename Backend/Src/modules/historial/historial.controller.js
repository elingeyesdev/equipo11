const db = require('../../config/db')

const historialController = {
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

      res.json(timeline)
    } catch (err) {
      console.error('[historial] error:', err)
      res.status(500).json({ msg: 'Error obteniendo historial', error: err.message })
    }
  },

  seedHistorial: async (req, res) => {
    try {
      const { rows: localidades } = await db.query('SELECT id, nombre FROM localidades')
      const { rows: metricas }    = await db.query('SELECT id, clave FROM metricas')
      const { rows: fuentes }     = await db.query("SELECT id FROM fuentes_datos WHERE clave = 'simulacion'")

      if (!fuentes.length) {
        return res.status(400).json({ msg: 'Fuente de datos "simulacion" no encontrada en la BD' })
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
        INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_datos_id)
        VALUES ${inserts.join(',')}
        ON CONFLICT DO NOTHING
      `)

      res.json({ msg: 'Datos de prueba inyectados (24 horas)', count: inserts.length })
    } catch (err) {
      console.error('[historial] seed error:', err)
      res.status(500).json({ msg: 'Error en seeding', error: err.message })
    }
  },

  clearHistorial: async (req, res) => {
    try {
      await db.query('DELETE FROM lecturas')
      res.json({ msg: 'Todo el historial ha sido borrado exitosamente.' })
    } catch (err) {
      console.error('[historial] clear error:', err)
      res.status(500).json({ msg: 'Error limpiando base de datos', error: err.message })
    }
  }
}

module.exports = historialController
