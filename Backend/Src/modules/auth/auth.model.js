const db = require('../../config/db')

const findByEmail = async (email) => {
  const { rows } = await db.query(
    'SELECT * FROM usuarios WHERE email = $1',
    [email]
  )
  return rows[0] || null
}

const createUser = async ({ nombre, apellido, email, password_hash }) => {
  const { rows } = await db.query(
    `INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash)
     VALUES ((SELECT id FROM roles WHERE clave = 'visualizador'), $1, $2, $3, $4)
     RETURNING id, nombre, apellido, email, rol_id`,
    [nombre, apellido, email, password_hash]
  )
  return rows[0]
}

module.exports = { findByEmail, createUser }
