const db = require('../../config/db')
const logger = require('../../utils/logger')
const { success, error } = require('../../utils/response')

const getRoles = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles ORDER BY id')
    success(res, { roles: rows })
  } catch (err) {
    logger.error('Error al obtener roles:', err)
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
    logger.error('Error al obtener usuarios:', err)
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
    logger.error('Error al actualizar rol de usuario:', err)
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
    logger.error('Error al actualizar estado del usuario:', err)
    error(res, 'Error al actualizar el estado', 500)
  }
}

const updatePreferencias = async (req, res) => {
  try {
    const userId = req.usuario.id
    console.log(">>> [updatePreferencias] RECEIVED BODY:", req.body);
    let {
      latitud,
      longitud,
      notif_email,
      notif_whatsapp,
      whatsapp_destino,
      notif_telegram,
      telegram_destino
    } = req.body

    // Convertir de forma segura a float o null
    let parsedLat = (latitud === '' || latitud === null || latitud === undefined) ? null : parseFloat(latitud);
    let parsedLng = (longitud === '' || longitud === null || longitud === undefined) ? null : parseFloat(longitud);

    if (parsedLat === null || parsedLng === null || isNaN(parsedLat) || isNaN(parsedLng)) {
      parsedLat = null;
      parsedLng = null;
      notif_email = false;
      notif_whatsapp = false;
      notif_telegram = false;
    }

    const queryParams = [
      parsedLat,
      parsedLng,
      !!notif_email,
      !!notif_whatsapp,
      whatsapp_destino || null,
      !!notif_telegram,
      telegram_destino || null,
      userId
    ];
    console.log(">>> [updatePreferencias] QUERY PARAMS:", queryParams);

    const { rows } = await db.query(
      `UPDATE usuarios
       SET latitud = $1,
           longitud = $2,
           notif_email = $3,
           notif_whatsapp = $4,
           whatsapp_destino = $5,
           notif_telegram = $6,
           telegram_destino = $7
       WHERE id = $8
       RETURNING id, nombre, apellido, email, rol_id,
                 latitud, longitud,
                 notif_email, notif_whatsapp, whatsapp_destino,
                 notif_telegram, telegram_destino`,
      queryParams
    )

    console.log(">>> [updatePreferencias] UPDATED ROW:", rows[0]);

    if (rows.length === 0) {
      return error(res, 'Usuario no encontrado', 404)
    }

    success(res, { mensaje: 'Preferencias actualizadas correctamente', usuario: rows[0] })
  } catch (err) {
    logger.error('Error al actualizar preferencias de usuario:', err)
    error(res, 'Error al actualizar preferencias', 500)
  }
}

const getPreferencias = async (req, res) => {
  try {
    const userId = req.usuario.id
    const { rows } = await db.query(
      `SELECT id, nombre, apellido, email, rol_id, 
              latitud, longitud, 
              notif_email, notif_whatsapp, whatsapp_destino, 
              notif_telegram, telegram_destino 
       FROM usuarios 
       WHERE id = $1`,
      [userId]
    )

    if (rows.length === 0) {
      return error(res, 'Usuario no encontrado', 404)
    }

    success(res, rows[0])
  } catch (err) {
    logger.error('Error al obtener preferencias de usuario:', err)
    error(res, 'Error al obtener preferencias', 500)
  }
}

module.exports = {
  getRoles,
  getUsuarios,
  updateUsuarioRol,
  updateUsuarioEstado,
  updatePreferencias,
  getPreferencias
}
