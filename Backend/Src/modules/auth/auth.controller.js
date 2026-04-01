const { register, login } = require('./auth.service')

const registerController = async (req, res) => {
  try {
    const { nombre, apellido, email, password } = req.body
    const usuario = await register({ nombre, apellido, email, password })
    res.status(201).json({ ok: true, mensaje: 'Usuario registrado correctamente', usuario })
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message })
  }
}

const loginController = async (req, res) => {
  try {
    const { email, password } = req.body
    const usuario = await login({ email, password })
    res.status(200).json({ ok: true, mensaje: 'Sesión iniciada', usuario })
  } catch (error) {
    res.status(401).json({ ok: false, mensaje: error.message })
  }
}

module.exports = { registerController, loginController }
