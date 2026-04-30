/**
 * Punto de entrada del servidor.
 * 
 * Integra Express (HTTP) y Socket.IO (WebSocket) en un solo servidor.
 * SRP: index.js solo se encarga de arrancar/configurar el servidor,
 *      no contiene lógica de negocio.
 */
require('dotenv').config()
const http = require('http')
const { Server } = require('socket.io')
const app = require('./src/app')
const { registerSocketEvents } = require('./src/modules/simulacion/simulacion.socket')
const { runScraper } = require('./src/modules/radar/radar.service')
const alertasService = require('./src/modules/alertas/alertas.service')

const PORT = process.env.PORT || 3000

// Crear servidor HTTP a partir de Express
const server = http.createServer(app)

// Crear instancia de Socket.IO sobre el mismo servidor HTTP
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

// Registrar los eventos de simulación
registerSocketEvents(io)

// Iniciar el servidor
server.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
  console.log(`🔌 WebSocket activo en el mismo puerto`)
  
  // Ejecutar el recopilador global una vez que el servidor arranca
  runScraper()
  // Pre-cargar umbrales y mapping de BD para el servicio de alertas
  await alertasService.cargarUmbralesCache()
})
