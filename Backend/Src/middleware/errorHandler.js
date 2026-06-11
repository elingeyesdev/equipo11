const logger = require('../utils/logger')

function errorHandler(err, req, res, next) {
  logger.error(`[Error no manejado] ${req.method} ${req.originalUrl}:`, err)

  const isDev = process.env.NODE_ENV !== 'production'

  res.status(err.status || 500).json({
    ok: false,
    error: isDev ? err.message : 'Error interno del servidor',
    ...(isDev && { stack: err.stack }),
  })
}

module.exports = { errorHandler }
