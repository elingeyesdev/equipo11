const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const authRoutes = require('./modules/auth/auth.routes')
const { globalLimiter, authLimiter, mapLimiter } = require('./middleware/rateLimiter')
const { success, error } = require('./utils/response')
const whatsappClient = require('./config/whatsappClient')
const cacheHeaders = require('./middleware/cacheHeaders')

const app = express()

// Seguridad: headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
      workerSrc: ["'self'", "blob:"],
      imgSrc: ["'self'", "blob:", "data:", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'", "https://api.mapbox.com", "wss:", "https://api.open-meteo.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
  crossOriginEmbedderPolicy: false,  // Necesario para Mapbox GL
  hsts: {
    maxAge: 31536000,         // 1 año
    includeSubDomains: true,
    preload: true,
  },
}))

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.set('trust proxy', 1)
app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: '1mb' }))
app.use('/api', globalLimiter)
app.use(cacheHeaders)

// Rutas
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/historial', require('./modules/historial/historial.routes'))
app.use('/api/umbrales', require('./modules/umbrales/umbrales.routes'))
app.use('/api/geografia', require('./modules/geografia/geografia.routes'))
app.use('/api/radar', mapLimiter, require('./modules/radar/radar.routes'))
app.use('/api/alertas', require('./modules/alertas/alertas.routes'))
app.use('/api/predictions', require('./modules/predictions/predictions.routes'))
app.use('/api/usuarios', require('./modules/usuarios/usuarios.routes'))
app.use('/api/reportes', require('./modules/reportes/reportes.routes'))
app.use('/api/simulacion', require('./modules/simulacion/simulacion.routes'))
app.use('/api/simulaciones', require('./modules/simulaciones/simulaciones.routes'))
app.use('/api/notificaciones', require('./modules/notificaciones/notificaciones.routes'))
app.use('/api/sensores', require('./modules/sensores/sensores.routes'))
app.use('/api/calidad-aire', mapLimiter, require('./modules/calidad_aire/aqi.routes'))
app.use('/api/plantillas', require('./modules/plantillas/plantillas.routes'))

// Ruta de prueba
app.get('/', (req, res) => success(res, { mensaje: 'API EnviroSense activa ✅' }))

app.get('/api/health', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return success(res, { uptime: process.uptime() })
  }
  return success(res, { status: 'healthy' })
})

app.get('/api/health/whatsapp', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return success(res, { status: whatsappClient.getStatus() })
  }
  return success(res, { status: 'active' })
})

const { errorHandler } = require('./middleware/errorHandler')
app.use(errorHandler)

module.exports = app
