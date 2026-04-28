const simulacionService = require('./simulacion.service')
const alertasService   = require('../alertas/alertas.service')

const DEFAULT_INTERVAL = 3000

// Severidades que se notifican en tiempo real (toast/modal).
// Las 'advertencia' se persisten en BD para el historial pero no se emiten,
// para evitar saturación visual cuando muchas ciudades están en zona-frontera.
const SEVERIDADES_TIEMPO_REAL = new Set(['critica', 'emergencia'])

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

        // ─ Deteccion de alertas ─
        const alertasNuevas = await alertasService.evaluarTick(data)
        if (alertasNuevas.length > 0) {
          // Persistimos todas las severidades (advertencia incluida) para el historial,
          // pero solo notificamos en tiempo real las críticas y emergencias.
          await alertasService.guardarAlertas(alertasNuevas)
          const paraEmitir = alertasNuevas.filter(a => SEVERIDADES_TIEMPO_REAL.has(a.severidad))
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
            const paraEmitir = alertasNuevas.filter(a => SEVERIDADES_TIEMPO_REAL.has(a.severidad))
            if (paraEmitir.length > 0) io.emit('alertas:nueva', paraEmitir)
          }
        }
      }
    })

    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`)
    })
  })
}

module.exports = { registerSocketEvents }
