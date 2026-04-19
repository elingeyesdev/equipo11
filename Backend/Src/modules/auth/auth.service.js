const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { findByEmail, createUser } = require('./auth.model')

// Registrar usuario
const register = async ({ nombre, apellido, email, password }) => {
  // Verificar si el email ya existe
  const existe = await findByEmail(email)
  if (existe) {
    throw new Error('El email ya está registrado')
  }

  // Hashear la contraseña
  const password_hash = await bcrypt.hash(password, 10)

  // Crear el usuario
  const nuevoUsuario = await createUser({ nombre, apellido, email, password_hash })
  return nuevoUsuario
}

// Iniciar sesión
const login = async ({ email, password }) => {
  // Buscar usuario por email
  const usuario = await findByEmail(email)
  if (!usuario) {
    throw new Error('Email o contraseña incorrectos')
  }

  // Verificar contraseña
  const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash)
  if (!passwordCorrecta) {
    throw new Error('Email o contraseña incorrectos')
  }

  // Retornar datos del usuario (sin el hash) + token JWT
  const { password_hash, ...usuarioSeguro } = usuario

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  )

  return { ...usuarioSeguro, token }
}

module.exports = { register, login }
