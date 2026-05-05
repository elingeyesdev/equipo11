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
const app = require('./Src/app')
const { registerSocketEvents } = require('./Src/modules/simulacion/simulacion.socket')
const { runScraper } = require('./Src/modules/radar/radar.service')
const alertasService = require('./Src/modules/alertas/alertas.service')
const { startTelegramListener } = require('./Src/modules/notificaciones/telegram.listener')
const { startSensorCron } = require('./Src/modules/sensores/sensores.service')

const PORT = process.env.PORT || 3000

// Crear servidor HTTP a partir de Express
const server = http.createServer(app)

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
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
  // Iniciar sensores IoT — datos reales de Open-Meteo cada 15 minutos
  startSensorCron()
  // Pre-cargar umbrales y mapping de BD para el servicio de alertas
  await alertasService.cargarUmbralesCache()
  // Iniciar el bot de Telegram en modo escucha
  startTelegramListener()
  
  // Verificar y poblar datos iniciales si es necesario (Fix para despliegues nuevos)
  try {
    const { initDatabase } = require('./Src/config/initDb')
    await initDatabase()
    console.log('✅ Verificación de base de datos completada')
  } catch (err) {
    console.error('❌ Error al inicializar datos:', err)
  }
})
