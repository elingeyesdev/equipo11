const express = require('express')
const cors    = require('cors')
const authRoutes = require('./modules/auth/auth.routes')

const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// Rutas
app.use('/api/auth', authRoutes)
app.use('/api/historial', require('./modules/historial/historial.routes'))
app.use('/api/umbrales', require('./modules/umbrales/umbrales.routes'))
app.use('/api/geografia', require('./modules/geografia/geografia.routes'))
app.use('/api/radar', require('./modules/radar/radar.routes'))
app.use('/api/alertas', require('./modules/alertas/alertas.routes'))

// Ruta de prueba
app.get('/', (req, res) => res.json({ mensaje: 'API EnviroSense activa ✅' }))

module.exports = app
