const db = require('../../config/db');

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
  
  const cityName = locRows[0].nombre;

  // 2. Obtener usuarios activos con tokens de FCM registrados
  const { rows: users } = await db.query(
    `SELECT t.token, u.nombre, u.latitud, u.longitud
     FROM fcm_tokens t
     JOIN usuarios u ON t.usuario_id = u.id
     WHERE u.activo = TRUE`
  );

  if (users.length === 0) return [];

  // Desactivar filtros por completo: retornar todos los tokens activos en desarrollo
  const matchingTokens = users.map(u => u.token);
  console.log(`[Push Test] Omitiendo filtros. Enviando push a todos los ${matchingTokens.length} dispositivos registrados.`);

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
