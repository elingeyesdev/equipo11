const pool = require('../config/db');

const mappingCache = {};

async function getDbMapping() {
  if (mappingCache.localidades && mappingCache.metricas) return mappingCache;

  const [locRes, metRes] = await Promise.all([
    pool.query('SELECT id, nombre FROM localidades'),
    pool.query('SELECT id, clave FROM metricas')
  ]);

  mappingCache.localidades = Object.fromEntries(
    locRes.rows.map(r => [r.nombre.toLowerCase(), r.id])
  );
  mappingCache.metricas = Object.fromEntries(
    metRes.rows.map(r => [r.clave, r.id])
  );
  return mappingCache;
}

function clearDbMapping() {
  mappingCache.localidades = undefined;
  mappingCache.metricas = undefined;
}

module.exports = { getDbMapping, clearDbMapping };
