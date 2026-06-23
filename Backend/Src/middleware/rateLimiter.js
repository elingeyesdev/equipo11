const rateLimit = require('express-rate-limit');

const rateLimitHandler = (req, res, next, options) => {
  res.set('Retry-After', Math.ceil(options.windowMs / 1000))
  res.status(options.statusCode).json({
    ok: false,
    error: options.message.error,
  })
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // relaxed limit to allow 5s polling dashboard
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => 
    req.originalUrl.startsWith('/api/radar') || 
    req.originalUrl.startsWith('/api/calidad-aire') || 
    req.originalUrl.startsWith('/api/sensores'),
  message: { ok: false, error: 'Too many requests, try again later' },
  handler: rateLimitHandler,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many auth attempts' },
  handler: rateLimitHandler,
});

const mapLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // Límite muy relajado para las texturas del mapa
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many map requests' },
  handler: rateLimitHandler,
});

module.exports = { globalLimiter, authLimiter, mapLimiter };
