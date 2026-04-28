const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { findByEmail, createUser, updatePassword } = require('./auth.model')
const { sendEmail } = require('../../utils/mailer')

const resetCodes = new Map()// Registrar usuario
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

// Solicitar código de recuperación
const forgotPassword = async ({ email }) => {
  const usuario = await findByEmail(email)
  if (!usuario) {
    throw new Error('No se encontró un usuario con ese correo')
  }

  // Generar código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 minutos

  resetCodes.set(email, { code, expiresAt })

  // Enviar correo
  const message = `Tu código de recuperación es: <b>${code}</b>. Es válido por 15 minutos.`
  await sendEmail(email, 'Recuperación de contraseña', 'Restablecer Contraseña', message)

  return true
}

// Restablecer la contraseña
const resetPassword = async ({ email, code, newPassword }) => {
  const record = resetCodes.get(email)
  
  if (!record || record.code !== code || record.expiresAt < Date.now()) {
    throw new Error('El código es inválido o ha expirado')
  }

  // Hashear la nueva contraseña
  const password_hash = await bcrypt.hash(newPassword, 10)

  // Actualizar la contraseña
  const result = await updatePassword(email, password_hash)
  
  if (!result) {
    throw new Error('No se pudo actualizar la contraseña')
  }

  // Borrar el código
  resetCodes.delete(email)

  return true
}

module.exports = { register, login, forgotPassword, resetPassword }
