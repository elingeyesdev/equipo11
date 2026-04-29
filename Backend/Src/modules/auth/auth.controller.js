const { register, login, forgotPassword, resetPassword } = require('./auth.service')
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('./auth.schema')

const registerController = async (req, res) => {
  // Paso 1: Validar datos con Zod
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    const errores = parsed.error.errors.map(e => ({
      campo: e.path[0],
      mensaje: e.message
    }))
    return res.status(400).json({ ok: false, mensaje: errores[0].mensaje, errores })
  }

  // Paso 2: Procesar registro con datos validados
  try {
    const usuario = await register(parsed.data)
    res.status(201).json({ ok: true, mensaje: 'Usuario registrado correctamente', usuario })
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message })
  }
}

const loginController = async (req, res) => {
  // Paso 1: Validar datos con Zod
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    const errores = parsed.error.errors.map(e => ({
      campo: e.path[0],
      mensaje: e.message
    }))
    return res.status(400).json({ ok: false, mensaje: errores[0].mensaje, errores })
  }

  // Paso 2: Procesar login con datos validados
  try {
    const usuario = await login(parsed.data)
    res.status(200).json({ ok: true, mensaje: 'Sesión iniciada', usuario })
  } catch (error) {
    res.status(401).json({ ok: false, mensaje: error.message })
  }
}

const forgotPasswordController = async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, mensaje: parsed.error.errors[0].message })
  }

  try {
    await forgotPassword(parsed.data)
    res.status(200).json({ ok: true, mensaje: 'Código de recuperación enviado al correo' })
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message })
  }
}

const resetPasswordController = async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, mensaje: parsed.error.errors[0].message })
  }

  try {
    await resetPassword(parsed.data)
    res.status(200).json({ ok: true, mensaje: 'Contraseña actualizada correctamente' })
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message })
  }
}

module.exports = { registerController, loginController, forgotPasswordController, resetPasswordController }
