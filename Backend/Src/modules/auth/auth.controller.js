const { register, login, forgotPassword, resetPassword } = require('./auth.service')
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('./auth.schema')
const { success, error } = require('../../utils/response')

const registerController = async (req, res) => {
  // Paso 1: Validar datos con Zod
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    const errores = (parsed.error.issues || []).map(e => ({
      campo: e.path[0],
      mensaje: e.message
    }))
    return error(res, errores[0]?.mensaje || 'Datos inválidos', 400)
  }

  // Paso 2: Procesar registro con datos validados
  try {
    const usuario = await register(parsed.data)
    success(res, { mensaje: 'Usuario registrado correctamente', usuario }, 201)
  } catch (err) {
    error(res, err.message, 400)
  }
}

const loginController = async (req, res) => {
  // Paso 1: Validar datos con Zod
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    const errores = (parsed.error.issues || []).map(e => ({
      campo: e.path[0],
      mensaje: e.message
    }))
    return error(res, errores[0]?.mensaje || 'Datos inválidos', 400)
  }

  // Paso 2: Procesar login con datos validados
  try {
    const usuario = await login(parsed.data)
    success(res, { mensaje: 'Sesión iniciada', usuario })
  } catch (err) {
    error(res, err.message, 401)
  }
}

const forgotPasswordController = async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return error(res, parsed.error.issues?.[0]?.message || 'Datos inválidos', 400)
  }

  try {
    await forgotPassword(parsed.data)
    success(res, { mensaje: 'Código de recuperación enviado al correo' })
  } catch (err) {
    error(res, err.message, 400)
  }
}

const resetPasswordController = async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return error(res, parsed.error.issues?.[0]?.message || 'Datos inválidos', 400)
  }

  try {
    await resetPassword(parsed.data)
    success(res, { mensaje: 'Contraseña actualizada correctamente' })
  } catch (err) {
    error(res, err.message, 400)
  }
}

module.exports = { registerController, loginController, forgotPasswordController, resetPasswordController }
