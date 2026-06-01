const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith('/api/radar') || req.originalUrl.startsWith('/api/calidad-aire'),
  message: { ok: false, error: 'Too many requests, try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many auth attempts' },
});

const mapLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // Límite muy relajado para las texturas del mapa
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many map requests' },
});

module.exports = { globalLimiter, authLimiter, mapLimiter };
