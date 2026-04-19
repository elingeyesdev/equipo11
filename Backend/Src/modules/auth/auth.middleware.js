/**
 * Middleware de autenticación JWT.
 * 
 * Verifica que el token enviado en el header Authorization (Bearer <token>)
 * sea válido y no haya expirado. Adjunta los datos del usuario a req.usuario.
 * 
 * Uso futuro: router.get('/ruta-protegida', verificarToken, handler)
 */
const jwt = require('jsonwebtoken')

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'Token no proporcionado' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = decoded
    next()
  } catch (error) {
    return res.status(401).json({ ok: false, mensaje: 'Token inválido o expirado' })
  }
}

module.exports = { verificarToken }
