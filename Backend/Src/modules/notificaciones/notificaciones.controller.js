const db = require('../../config/db');

const getSettings = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM configuracion_notificaciones ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateSettings = async (req, res) => {
  const { settings } = req.body; // Array of { tipo, habilitado, destino }
  
  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: 'Settings must be an array' });
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
    res.json({ msg: 'Configuración actualizada correctamente' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getSettings, updateSettings };
