const sequelize = require('../../config/db')

// Buscar usuario por email
const findByEmail = async (email) => {
  const [results] = await sequelize.query(
    'SELECT * FROM usuarios WHERE email = $1',
    { bind: [email] }
  )
  return results[0] || null
}

// Crear nuevo usuario
const createUser = async ({ nombre, apellido, email, password_hash }) => {
  const [results] = await sequelize.query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, apellido, email, created_at`,
    { bind: [nombre, apellido, email, password_hash] }
  )
  return results[0]
}

module.exports = { findByEmail, createUser }
