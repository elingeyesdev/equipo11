const db = require('../../config/db');

/**
 * Obtiene los tokens FCM de los usuarios que se encuentran en el radio de 50km de la localidad.
 * @param {number} localidadId
 * @returns {Promise<string[]>}
 */
async function getSubscriberTokens(localidadId) {
  // 1. Obtener la latitud y longitud de la localidad afectada por la alerta
  const { rows: locRows } = await db.query(
    'SELECT latitud, longitud FROM localidades WHERE id = $1',
    [localidadId]
  );
  if (locRows.length === 0) return [];
  
  const locLat = parseFloat(locRows[0].latitud);
  const locLng = parseFloat(locRows[0].longitud);

  if (isNaN(locLat) || isNaN(locLng)) return [];

  // 2. Obtener usuarios con coordenadas configuradas y con tokens de FCM registrados
  const { rows } = await db.query(
    `SELECT t.token, u.latitud, u.longitud
     FROM fcm_tokens t
     JOIN usuarios u ON t.usuario_id = u.id
     WHERE u.latitud IS NOT NULL 
       AND u.longitud IS NOT NULL
       AND u.activo = TRUE`
  );

  if (rows.length === 0) return [];

  // Fórmula Haversine para obtener distancia exacta en Km
  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Filtrar tokens de usuarios en un radio de 50km
  const matchingTokens = rows
    .filter(r => {
      const dist = getDistanceKm(locLat, locLng, parseFloat(r.latitud), parseFloat(r.longitud));
      return dist <= 50;
    })
    .map(r => r.token);

  return matchingTokens;
}

/**
 * Guarda o actualiza el token FCM de un usuario.
 * Evita duplicados para el mismo usuario.
 * @param {number} usuarioId
 * @param {string} token
 */
async function saveToken(usuarioId, token) {
  await db.query(
    `INSERT INTO fcm_tokens (usuario_id, token)
     VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET usuario_id = $1, creado_en = NOW()`,
    [usuarioId, token]
  );
}

/**
 * Elimina un token FCM de la base de datos (desuscripción).
 * @param {string} token
 */
async function removeToken(token) {
  await db.query(
    'DELETE FROM fcm_tokens WHERE token = $1',
    [token]
  );
}

module.exports = {
  getSubscriberTokens,
  saveToken,
  removeToken
};
