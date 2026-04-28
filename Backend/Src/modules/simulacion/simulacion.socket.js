const simulacionService = require('./simulacion.service')

const DEFAULT_INTERVAL = 3000

function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`)

    socket.emit('simulacion:estado', {
      running: simulacionService.isRunning(),
      ...simulacionService.getCurrentState()
    })

    socket.on('simulacion:iniciar', (options = {}) => {
      const interval = options.interval || DEFAULT_INTERVAL

      const started = simulacionService.start(interval, (data) => {
        io.emit('simulacion:datos', data)
      })

      if (started) {
        console.log(`▶️  Simulación iniciada (intervalo: ${interval}ms)`)
        io.emit('simulacion:estado', { running: true, interval })
      }
    })

    socket.on('simulacion:detener', () => {
      const stopped = simulacionService.stop()

      if (stopped) {
        console.log('⏹  Simulación detenida')
        io.emit('simulacion:estado', { running: false })
      }
    })

    socket.on('simulacion:inyectar', ({ cityId, data } = {}) => {
      if (!cityId || !data || typeof data !== 'object') return

      const ok = simulacionService.injectData(cityId, data)
      if (ok) {
        const snapshot = simulacionService.getCurrentState()
        io.emit('simulacion:datos', snapshot)
        console.log(`💉 Datos inyectados en "${cityId}":`, data)
      }
    })

    socket.on('simulacion:alertas', ({ email }) => {
      if (!email) return;
      simulacionService.setAlertEmail(email);
      console.log(`📧 Alertas configuradas para: ${email}`);
      socket.emit('simulacion:alertas:ok', { email });
    })

    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`)
    })
  })
}

module.exports = { registerSocketEvents }
