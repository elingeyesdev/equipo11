const db = require('../../config/db');

const getLocalidades = async ({ pais_codigo, region_id, bbox, limit = 500 } = {}) => {
  const params = [];
  const conditions = [];

  if (pais_codigo) {
    params.push(pais_codigo.toUpperCase());
    conditions.push(`p.codigo = $${params.length}`);
  }
  if (region_id) {
    params.push(region_id);
    conditions.push(`l.region_id = $${params.length}`);
  }
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    params.push(minLng, minLat, maxLng, maxLat);
    conditions.push(
      `l.longitud BETWEEN $${params.length - 3} AND $${params.length - 1}`,
      `l.latitud  BETWEEN $${params.length - 2} AND $${params.length}`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(Number(limit), 2000));

  const sql = `
    SELECT
      l.id,
      l.nombre,
      l.latitud,
      l.longitud,
      r.nombre  AS region,
      p.nombre  AS pais,
      p.codigo
    FROM localidades l
    JOIN regiones r ON r.id = l.region_id
    JOIN paises   p ON p.id = r.pais_id
    ${where}
    ORDER BY l.nombre
    LIMIT $${params.length}
  `;

  const { rows } = await db.query(sql, params);
  return rows;
};

const getRegionesGeoJSON = async () => {
  const sql = `
    SELECT
      r.id,
      r.nombre,
      r.nivel,
      p.codigo  AS pais_codigo,
      r.geojson
    FROM regiones r
    JOIN paises p ON p.id = r.pais_id
    WHERE r.geojson IS NOT NULL
    ORDER BY p.codigo, r.nombre
  `;

  const { rows } = await db.query(sql);

  return rows.map(row => ({
    type: 'Feature',
    geometry: row.geojson,
    properties: {
      id: row.id,
      nombre: row.nombre,
      pais_codigo: row.pais_codigo,
      nivel: row.nivel,
    },
  }));
};

module.exports = { getLocalidades, getRegionesGeoJSON };
