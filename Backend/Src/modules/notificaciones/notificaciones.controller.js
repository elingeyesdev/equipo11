const db = require('../../config/db');
const { success, error } = require('../../utils/response');

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

module.exports = { getSettings, updateSettings };
