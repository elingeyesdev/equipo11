const express = require('express')
const cors    = require('cors')
const authRoutes = require('./modules/auth/auth.routes')

const app = express()

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: corsOrigin }))
app.use(express.json())

// Rutas
app.use('/api/auth', authRoutes)
app.use('/api/historial', require('./modules/historial/historial.routes'))
app.use('/api/umbrales', require('./modules/umbrales/umbrales.routes'))
app.use('/api/geografia', require('./modules/geografia/geografia.routes'))
app.use('/api/radar', require('./modules/radar/radar.routes'))
app.use('/api/alertas', require('./modules/alertas/alertas.routes'))
app.use('/api/usuarios', require('./modules/usuarios/usuarios.routes'))
app.use('/api/reportes', require('./modules/reportes/reportes.routes'))
app.use('/api/simulacion', require('./modules/simulacion/simulacion.routes'))
app.use('/api/notificaciones', require('./modules/notificaciones/notificaciones.routes'))
app.use('/api/sensores', require('./modules/sensores/sensores.routes'))

// Ruta de prueba
app.get('/', (req, res) => res.json({ mensaje: 'API EnviroSense activa ✅' }))

module.exports = app
