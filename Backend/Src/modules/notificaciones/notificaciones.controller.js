const db = require('../../config/db');
const { success, error } = require('../../utils/response');
const { saveToken, removeToken } = require('../notifications/notification.model');
const z = require('zod');
const logger = require('../../utils/logger');

// Validador Zod para el token
const TokenSchema = z.object({
  token: z.string().min(10, 'El token es demasiado corto').max(1024, 'El token es demasiado largo')
});

const getSettings = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM configuracion_notificaciones ORDER BY id ASC');
    success(res, rows);
  } catch (err) {
    error(res, err.message, 500);
  }
};

const updateSettings = async (req, res) => {
  const { settings } = req.body; // Array of { tipo, habilitado, destino }
  
  if (!Array.isArray(settings)) {
    return error(res, 'Settings must be an array', 400);
  }

  try {
    await db.query('BEGIN');
    for (const s of settings) {
      await db.query(
        'UPDATE configuracion_notificaciones SET habilitado = $1, destino = $2, updated_at = NOW() WHERE tipo = $3',
        [s.habilitado, s.destino, s.tipo]
      );
    }
    await db.query('COMMIT');
    success(res, { mensaje: 'Configuración actualizada correctamente' });
  } catch (err) {
    await db.query('ROLLBACK');
    error(res, err.message, 500);
  }
};

const subscribe = async (req, res) => {
  try {
    const parseResult = TokenSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.errors[0].message, 400);
    }

    const { token } = parseResult.data;
    const userId = req.usuario?.id;
    if (!userId) {
      return error(res, 'No autorizado: usuario no identificado.', 401);
    }

    await saveToken(userId, token);
    logger.info(`[notificaciones] Token FCM suscrito para el usuario ${userId}`);
    success(res, { mensaje: 'Notificaciones activadas correctamente.' });
  } catch (err) {
    logger.error('[notificaciones] Error al guardar suscripción push:', err);
    error(res, 'Error al activar las notificaciones push.', 500);
  }
};

const unsubscribe = async (req, res) => {
  try {
    const parseResult = TokenSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, parseResult.error.errors[0].message, 400);
    }

    const { token } = parseResult.data;
    await removeToken(token);
    logger.info('[notificaciones] Token FCM desuscrito de la base de datos');
    success(res, { mensaje: 'Notificaciones desactivadas correctamente.' });
  } catch (err) {
    logger.error('[notificaciones] Error al eliminar suscripción push:', err);
    error(res, 'Error al desactivar las notificaciones push.', 500);
  }
};

module.exports = { 
  getSettings, 
  updateSettings,
  subscribe,
  unsubscribe
};
