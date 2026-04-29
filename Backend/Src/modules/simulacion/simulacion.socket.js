const simulacionService = require('./simulacion.service')
const alertasService   = require('../alertas/alertas.service')

const DEFAULT_INTERVAL = 3000

// La política de qué se persiste y qué se notifica vive en alertasService:
//  - evaluarTick() ya descarta informativa + advertencia.
//  - filtrarParaEmision() aplica cooldown por (ciudad, métrica).
// Aquí sólo coordinamos los pasos.

function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`)

    socket.emit('simulacion:estado', {
      running: simulacionService.isRunning(),
      ...simulacionService.getCurrentState()
    })

    socket.on('simulacion:iniciar', (options = {}) => {
      const interval = options.interval || DEFAULT_INTERVAL

      const started = simulacionService.start(interval, async (data) => {
        io.emit('simulacion:datos', data)

        // ─ Detección de alertas ─
        const alertasNuevas = await alertasService.evaluarTick(data)
        if (alertasNuevas.length > 0) {
          await alertasService.guardarAlertas(alertasNuevas)
          const paraEmitir = alertasService.filtrarParaEmision(alertasNuevas)
          if (paraEmitir.length > 0) io.emit('alertas:nueva', paraEmitir)
        }
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

    socket.on('simulacion:inyectar', async ({ cityId, data } = {}) => {
      if (!cityId || !data || typeof data !== 'object') return

      const ok = simulacionService.injectData(cityId, data)
      if (ok) {
        const snapshot = simulacionService.getCurrentState()
        io.emit('simulacion:datos', snapshot)
        console.log(`💉 Datos inyectados en "${cityId}":`, data)

        // ─ Detección de alertas solo para la ciudad inyectada ─
        // Evaluamos un mini-tick que contiene únicamente la ciudad afectada
        // (no las 60+ ciudades del snapshot) para no disparar alertas en
        // localidades que el usuario no tocó.
        const ciudadInyectada = snapshot.cities.find(c => c.id === cityId)
        if (ciudadInyectada) {
          const alertasNuevas = await alertasService.evaluarTick({ cities: [ciudadInyectada] })
          if (alertasNuevas.length > 0) {
            await alertasService.guardarAlertas(alertasNuevas)
            const paraEmitir = alertasService.filtrarParaEmision(alertasNuevas)
            if (paraEmitir.length > 0) io.emit('alertas:nueva', paraEmitir)
          }
        }
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
