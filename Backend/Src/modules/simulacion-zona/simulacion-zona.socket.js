/**
 * simulacion-zona.socket.js
 *
 * Registra los eventos WebSocket para la simulación de zona.
 *
 * Eventos recibidos:
 *   zona:iniciar  — { metricaClave, escenario, dias, intervalMinutos, intervalSimSeg, puntos, nombreZona }
 *   zona:detener  — (sin payload)
 *
 * Eventos emitidos:
 *   zona:estado   — { running, sesionId, totalLecturas, centroide, fechaInicio }
 *   zona:tick     — { sesionId, metricaClave, valor, tiempo, tickIdx, totalTicks, progreso }
 *   zona:error    — { message }
 */

const zonaService = require('./simulacion-zona.service');

function registerZonaSocketEvents(io) {
  io.on('connection', (socket) => {

    // Al conectar, enviar estado actual (por si el cliente se reconecta)
    socket.emit('zona:estado', zonaService.getEstado());

    // ─── Iniciar simulación de zona ──────────────────────────────────────────
    socket.on('zona:iniciar', async (payload = {}) => {
      const {
        metricaClave,
        escenario,
        dias,
        intervalMinutos,
        intervalSimSeg,
        puntos,
        nombreZona,
      } = payload;

      // Validaciones básicas
      if (!metricaClave || !escenario || !dias || !intervalMinutos || !intervalSimSeg) {
        socket.emit('zona:error', { message: 'Faltan parámetros requeridos (metricaClave, escenario, dias, intervalMinutos, intervalSimSeg).' });
        return;
      }
      if (!puntos || puntos.length < 3) {
        socket.emit('zona:error', { message: 'Se necesitan al menos 3 puntos para definir el área.' });
        return;
      }
      if (zonaService.isRunning()) {
        socket.emit('zona:error', { message: 'Ya hay una simulación de zona activa. Detenla antes de iniciar una nueva.' });
        return;
      }

      console.log(`🔬 Iniciando simulación de zona: ${metricaClave} / ${escenario.id} / ${dias}d`);

      try {
        const resultado = await zonaService.iniciarSimulacionZona(
          { metricaClave, escenario, dias, intervalMinutos, intervalSimSeg, puntos, nombreZona },
          (tickPayload) => {
            // Emitir el tick a TODOS los clientes conectados
            io.emit('zona:tick', tickPayload);
          }
        );

        console.log(`✅ Zona iniciada — sesionId: ${resultado.sesionId}, lecturas: ${resultado.totalLecturas}`);
        io.emit('zona:estado', {
          running: true,
          sesionId: resultado.sesionId,
          localidadId: resultado.localidadId,
          totalLecturas: resultado.totalLecturas,
          centroide: resultado.centroide,
          fechaInicio: resultado.fechaInicio,
          metricaClave,
          escenarioId: escenario.id,
          escenarioNombre: escenario.nombre,
        });

      } catch (err) {
        console.error('[zona:iniciar] Error:', err.message);
        socket.emit('zona:error', { message: err.message });
      }
    });

    // ─── Detener simulación de zona ──────────────────────────────────────────
    socket.on('zona:detener', async () => {
      console.log('⏹  Deteniendo simulación de zona');
      try {
        const stopped = await zonaService.detenerSimulacionZona();
        if (stopped) {
          io.emit('zona:estado', { running: false });
          console.log('✅ Simulación de zona detenida');
        }
      } catch (err) {
        console.error('[zona:detener] Error:', err.message);
        socket.emit('zona:error', { message: err.message });
      }
    });

  });
}

module.exports = { registerZonaSocketEvents };
