const db = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Calcula la distancia entre dos coordenadas en Kilómetros usando la fórmula Haversine.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Obtiene los tokens FCM de los usuarios que se encuentran en el radio de 50km de la localidad.
 * @param {number} localidadId
 * @returns {Promise<string[]>}
 */
async function getSubscriberTokens(localidadId) {
  // 1. Obtener la latitud y longitud de la localidad afectada por la alerta
  const { rows: locRows } = await db.query(
    'SELECT id, nombre, latitud, longitud FROM localidades WHERE id = $1',
    [localidadId]
  );
  if (locRows.length === 0) return [];
  const { latitud, longitud } = locRows[0];

  // 2. Obtener usuarios activos con tokens de FCM registrados
  const { rows: users } = await db.query(
    `SELECT t.token, u.latitud, u.longitud
     FROM fcm_tokens t
     JOIN usuarios u ON t.usuario_id = u.id
     WHERE u.activo = TRUE`
  );

  if (users.length === 0) return [];

  if (process.env.NODE_ENV === 'production') {
    // Filtro 50km en producción. Si no tiene ubicación se incluye siempre
    return users
      .filter(u => {
        if (u.latitud === null || u.longitud === null) return true;
        const dist = haversineKm(latitud, longitud, u.latitud, u.longitud);
        return dist <= 50;
      })
      .map(u => u.token);
  }

  // En desarrollo: todos los tokens activos
  logger.info(`[Push Test] Omitiendo filtros. Enviando push a todos los ${users.length} dispositivos registrados.`);
  return users.map(u => u.token);
}

/**
 * Obtiene los tokens FCM de un usuario específico.
 * @param {number} userId
 * @returns {Promise<string[]>}
 */
async function getSubscriberTokensByUserId(userId) {
  const { rows } = await db.query(
    'SELECT token FROM fcm_tokens WHERE usuario_id = $1',
    [userId]
  );
  return rows.map(r => r.token);
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
  getSubscriberTokensByUserId,
  saveToken,
  removeToken
};
