const express = require('express')
const cors    = require('cors')
const authRoutes = require('./modules/auth/auth.routes')

const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// Rutas
app.use('/api/auth', authRoutes)
app.use('/api/historial', require('./modules/historial/historial.routes'))

// Ruta de prueba
app.get('/', (req, res) => res.json({ mensaje: 'API EnviroSense activa ✅' }))

module.exports = app
