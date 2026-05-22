const db = require('../../config/db')
const logger = require('../../utils/logger')
const { success, error } = require('../../utils/response')

const getRoles = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles ORDER BY id')
    success(res, { roles: rows })
  } catch (err) {
    logger.error('Error al obtener roles:', error)
    error(res, 'Error al obtener roles', 500)
  }
}

const getUsuarios = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.creado_en, u.ultimo_login, r.clave AS rol_clave, r.nombre AS rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      ORDER BY u.id DESC
    `
    const { rows } = await db.query(query)
    success(res, { usuarios: rows })
  } catch (err) {
    logger.error('Error al obtener usuarios:', error)
    error(res, 'Error al obtener usuarios', 500)
  }
}

const updateUsuarioRol = async (req, res) => {
  try {
    const { id } = req.params
    const { rol_id } = req.body

    const { rows } = await db.query(
      'UPDATE usuarios SET rol_id = $1 WHERE id = $2 RETURNING id',
      [rol_id, id]
    )

    if (rows.length === 0) {
      return error(res, 'Usuario no encontrado', 404)
    }

    success(res, { mensaje: 'Rol de usuario actualizado' })
  } catch (err) {
    logger.error('Error al actualizar rol de usuario:', error)
    error(res, 'Error al actualizar el rol', 500)
  }
}

const updateUsuarioEstado = async (req, res) => {
  try {
    const { id } = req.params
    const { activo } = req.body

    const { rows } = await db.query(
      'UPDATE usuarios SET activo = $1 WHERE id = $2 RETURNING id',
      [activo, id]
    )

    if (rows.length === 0) {
      return error(res, 'Usuario no encontrado', 404)
    }

    success(res, { mensaje: 'Estado del usuario actualizado' })
  } catch (err) {
    logger.error('Error al actualizar estado del usuario:', error)
    error(res, 'Error al actualizar el estado', 500)
  }
}

module.exports = {
  getRoles,
  getUsuarios,
  updateUsuarioRol,
  updateUsuarioEstado
}
