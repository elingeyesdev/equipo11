const db = require('../../config/db');

const getCiudadHistorial = async (localidadId, horas = 24) => {
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
  `, [localidadId, horas]);

  return rows;
};

const getHistorial = async () => {
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
  `);

  return rows;
};

const seedHistorial = async () => {
  const { rows: localidades } = await db.query('SELECT id, nombre FROM localidades');
  const { rows: metricas }    = await db.query('SELECT id, clave FROM metricas');
  const { rows: fuentes }     = await db.query("SELECT id FROM fuentes_datos WHERE clave = 'simulacion'");

  if (!fuentes.length) {
    throw new Error('Fuente de datos "simulacion" no encontrada en la BD');
  }

  const fuenteId = fuentes[0].id;
  const now = Date.now();

  const tiempos = [];
  const locIds = [];
  const metIds = [];
  const valores = [];

  for (let i = 24; i >= 0; i--) {
    const tiempo = new Date(now - i * 60 * 60 * 1000).toISOString();
    for (const loc of localidades) {
      for (const met of metricas) {
        tiempos.push(tiempo);
        locIds.push(loc.id);
        metIds.push(met.id);
        valores.push(parseFloat((Math.random() * 100).toFixed(2)));
      }
    }
  }

  await db.query(
    `INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
     SELECT * FROM unnest(
       $1::timestamptz[], $2::int[], $3::int[], $4::numeric[], $5::int[]
     )
     ON CONFLICT DO NOTHING`,
    [tiempos, locIds, metIds, valores, Array(tiempos.length).fill(fuenteId)]
  );

  return tiempos.length;
};

const clearHistorial = async () => {
  await db.query('DELETE FROM lecturas');
};

module.exports = { getCiudadHistorial, getHistorial, seedHistorial, clearHistorial };
