const db = require('../../config/db')

const getRoles = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM roles ORDER BY id')
    res.json({ ok: true, roles: rows })
  } catch (error) {
    console.error('Error al obtener roles:', error)
    res.status(500).json({ ok: false, mensaje: 'Error al obtener roles' })
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
    res.json({ ok: true, usuarios: rows })
  } catch (error) {
    console.error('Error al obtener usuarios:', error)
    res.status(500).json({ ok: false, mensaje: 'Error al obtener usuarios' })
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
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' })
    }

    res.json({ ok: true, mensaje: 'Rol de usuario actualizado' })
  } catch (error) {
    console.error('Error al actualizar rol de usuario:', error)
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar el rol' })
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
      return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' })
    }

    res.json({ ok: true, mensaje: 'Estado del usuario actualizado' })
  } catch (error) {
    console.error('Error al actualizar estado del usuario:', error)
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar el estado' })
  }
}

module.exports = {
  getRoles,
  getUsuarios,
  updateUsuarioRol,
  updateUsuarioEstado
}
