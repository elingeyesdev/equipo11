const db = require('../../config/db');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

// POST /api/plantillas
const crearPlantilla = async (req, res) => {
  try {
    const { nombre_plantilla, tipo, configuracion } = req.body;
    const usuario_id = req.usuario.id; 

    if (!nombre_plantilla || !tipo || !configuracion) {
      return error(res, 'Faltan datos obligatorios (nombre_plantilla, tipo, configuracion)', 400);
    }

    const { rows } = await db.query(
      `INSERT INTO usuarios_plantillas (usuario_id, nombre_plantilla, tipo, configuracion)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [usuario_id, nombre_plantilla, tipo, configuracion]
    );

    success(res, rows[0], 'Plantilla creada con éxito', 201);
  } catch (err) {
    logger.error('Error al crear plantilla:', err);
    error(res, 'Error interno al crear plantilla', 500);
  }
};

// GET /api/plantillas
const obtenerPlantillas = async (req, res) => {
  try {
    const usuario_id = req.usuario.id;

    const { rows } = await db.query(
      `SELECT * FROM usuarios_plantillas WHERE usuario_id = $1 ORDER BY creado_en DESC`,
      [usuario_id]
    );

    success(res, rows, 'Plantillas obtenidas con éxito');
  } catch (err) {
    logger.error('Error al obtener plantillas:', err);
    error(res, 'Error interno al obtener plantillas', 500);
  }
};

// DELETE /api/plantillas/:id
const eliminarPlantilla = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.usuario.id;

    const { rowCount } = await db.query(
      `DELETE FROM usuarios_plantillas WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    if (rowCount === 0) {
      return error(res, 'Plantilla no encontrada o no tienes permisos para eliminarla', 404);
    }

    success(res, null, 'Plantilla eliminada con éxito');
  } catch (err) {
    logger.error('Error al eliminar plantilla:', err);
    error(res, 'Error interno al eliminar plantilla', 500);
  }
};

module.exports = {
  crearPlantilla,
  obtenerPlantillas,
  eliminarPlantilla
};
