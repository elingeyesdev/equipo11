const pool = require('../../config/db')

// Buscar usuario por email
const findByEmail = async (email) => {
  const result = await pool.query(
    'SELECT * FROM usuarios WHERE email = $1',
    [email]
  )
  return result.rows[0] || null
}

// Crear nuevo usuario
const createUser = async ({ nombre, apellido, email, password_hash }) => {
  const result = await pool.query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, apellido, email, created_at`,
    [nombre, apellido, email, password_hash]
  )
  return result.rows[0]
}

module.exports = { findByEmail, createUser }
