/**
 * Manejo de eventos Socket.IO para la simulación.
 * 
 * Principios aplicados:
 * - SRP: Solo se encarga de la comunicación WebSocket, delega la lógica al service.
 * - KISS: Tres eventos simples (iniciar, detener, estado).
 * - DIP: Depende de la abstracción del service (start/stop/isRunning), no de su implementación.
 */
const simulacionService = require('./simulacion.service')

const DEFAULT_INTERVAL = 3000

/**
 * Registra los eventos de simulación en una instancia de Socket.IO.
 * Se llama una sola vez al iniciar el servidor.
 */
function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`)

    // Enviar estado actual al conectarse
    socket.emit('simulacion:estado', {
      running: simulacionService.isRunning(),
      ...simulacionService.getCurrentState()
    })

    // --- Iniciar simulación ---
    socket.on('simulacion:iniciar', (options = {}) => {
      const interval = options.interval || DEFAULT_INTERVAL

const MetricaAmbiental = require('../../models/MetricaAmbiental');

      const started = simulacionService.start(interval, async (data) => {
        // Emitir datos a TODOS los clientes conectados
        io.emit('simulacion:datos', data)
        
        // Autoguardado en BD:
        try {
          if (data && data.cities) {
            const recordsToInsert = data.cities.map(city => ({
              latitud: city.latitude,
              longitud: city.longitude,
              ciudad: city.name,
              temperatura: city.data?.temperature,
              aqi: city.data?.aqi,
              condicion_climatica: city.data?.weatherCode ? String(city.data.weatherCode) : null,
              detalles: {
                humidity: city.data?.humidity,
                waterQuality: city.data?.waterQuality,
                noise: city.data?.noise
              }
            }));
            await MetricaAmbiental.bulkCreate(recordsToInsert);
          }
        } catch(err) {
           console.error("Error al autoguardar simulación:", err);
        }
      })

      if (started) {
        console.log(`▶️  Simulación iniciada (intervalo: ${interval}ms)`)
        io.emit('simulacion:estado', { running: true, interval })
      }
    })

    // --- Detener simulación ---
    socket.on('simulacion:detener', () => {
      const stopped = simulacionService.stop()

      if (stopped) {
        console.log('⏹  Simulación detenida')
        io.emit('simulacion:estado', { running: false })
      }
    })

    // --- Inyección manual de datos ---
    socket.on('simulacion:inyectar', ({ cityId, data } = {}) => {
      if (!cityId || !data || typeof data !== 'object') return

      const ok = simulacionService.injectData(cityId, data)
      if (ok) {
        const snapshot = simulacionService.getCurrentState()
        io.emit('simulacion:datos', snapshot)
        console.log(`💉 Datos inyectados en "${cityId}":`, data)
      }
    })

    // --- Desconexión ---
    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`)
    })
  })
}

module.exports = { registerSocketEvents }
