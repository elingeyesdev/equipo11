/**
 * Middleware de autenticación JWT.
 * 
 * Verifica que el token enviado en el header Authorization (Bearer <token>)
 * sea válido y no haya expirado. Adjunta los datos del usuario a req.usuario.
 * 
 * Uso futuro: router.get('/ruta-protegida', verificarToken, handler)
 */
const jwt = require('jsonwebtoken')
const { success, error } = require('../../utils/response')

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Token no proporcionado', 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: "Acceso denegado o token inválido" })
  }
}

function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return error(res, 'Usuario no autenticado', 401)
    }
    
    // Convertir a array si pasaron un string ('admin' -> ['admin'])
    const rolesArray = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos]
    
    if (!rolesArray.includes(req.usuario.rol)) {
      return error(res, 'Acceso denegado. No tienes permisos para realizar esta acción.', 403)
    }
    next()
  }
}

module.exports = { verificarToken, verificarRol }
