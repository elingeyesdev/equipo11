/**
 * Punto de entrada del servidor.
 * 
 * Integra Express (HTTP) y Socket.IO (WebSocket) en un solo servidor.
 * SRP: index.js solo se encarga de arrancar/configurar el servidor,
 *      no contiene lógica de negocio.
 */
require('dotenv').config()

// Validar variables de entorno ANTES de cualquier otro require
require('./Src/config/env')

const http = require('http')
const { Server } = require('socket.io')
const app = require('./Src/app')
const { registerSocketEvents } = require('./Src/modules/simulacion/simulacion.socket')
const { registerZonaSocketEvents } = require('./Src/modules/simulacion-zona/simulacion-zona.socket')
const { runScraper } = require('./Src/modules/radar/radar.service')
const alertasService = require('./Src/modules/alertas/alertas.service')
const { startTelegramListener } = require('./Src/modules/notificaciones/telegram.listener')
const { startSensorCron, stopSensorCron } = require('./Src/modules/sensores/sensores.service')
const logger = require('./Src/utils/logger');
const pool = require('./Src/config/db');

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

// Registrar los eventos de simulación global
registerSocketEvents(io)
// Registrar los eventos de simulación por zona (nueva lógica)
registerZonaSocketEvents(io)

// Iniciar el servidor
server.listen(PORT, async () => {
  logger.info(`🚀 Servidor corriendo en http://localhost:${PORT}`)
  logger.info(`🔌 WebSocket activo en el mismo puerto`)
  
  // 1. PRIMERO: Verificar y poblar datos iniciales (Asegura que las tablas existan antes que los servicios)
  try {
    const { initDatabase } = require('./Src/config/initDb')
    await initDatabase()
    logger.info('✅ Base de datos inicializada correctamente')
  } catch (err) {
    logger.error('❌ Error FATAL al inicializar base de datos:', err)
  }

  // 2. DESPUÉS: Iniciar servicios que dependen de la base de datos
  // Ejecutar el recopilador global una vez que el servidor arranca
  runScraper()
  // Iniciar sensores IoT — datos reales de Open-Meteo cada 15 minutos
  startSensorCron()
  // Pre-cargar umbrales y mapping de BD para el servicio de alertas
  await alertasService.cargarUmbralesCache()
  // Iniciar el bot de Telegram en modo escucha
  startTelegramListener()
})

// ────────────────────────────────────────────────────────────
// Graceful shutdown: libera recursos al recibir SIGTERM/SIGINT
// ────────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`Recibido ${signal}, cerrando servidor ordenadamente...`);

  // 1. Detener cron de sensores
  stopSensorCron();

  // 2. Cerrar servidor HTTP (rechaza nuevas conexiones, cierra WebSockets)
  server.close(() => {
    logger.info('Servidor HTTP cerrado');

    // 3. Cerrar pool de base de datos
    pool.end()
      .then(() => {
        logger.info('Pool de base de datos cerrado');
        process.exit(0);
      })
      .catch(err => {
        logger.error('Error cerrando pool de DB:', err);
        process.exit(1);
      });
  });

  // 4. Forzar salida si no se completó en 10s
  setTimeout(() => {
    logger.error('Cierre forzado tras timeout de 10s');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
