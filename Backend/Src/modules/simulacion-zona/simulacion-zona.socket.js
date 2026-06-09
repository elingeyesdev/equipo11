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
const logger = require('../../utils/logger');

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
        zonas,
        puntos,
        nombreZona,
      } = payload;

      // Validaciones básicas
      if (!metricaClave || !dias || !intervalMinutos || !intervalSimSeg) {
        socket.emit('zona:error', { message: 'Faltan parámetros de tiempo o métrica.' });
        return;
      }

      // Si vienen puntos (modo legado), lo convertimos al nuevo formato de zonas
      let finalZonas = zonas;
      if (!finalZonas && puntos && puntos.length >= 3) {
        const centroide = zonaService.calcCentroide ? zonaService.calcCentroide(puntos) : { lat: puntos[0].lat, lng: puntos[0].lng };
        finalZonas = [{ nombre: nombreZona || 'Zona 1', centroide, escenario }];
      }

      if (!finalZonas || finalZonas.length === 0) {
        socket.emit('zona:error', { message: 'Se necesita al menos una zona válida para simular.' });
        return;
      }

      if (zonaService.isRunning()) {
        socket.emit('zona:error', { message: 'Ya hay una simulación activa.' });
        return;
      }

      logger.info(`🔬 Iniciando simulación de zonas: ${metricaClave} (${finalZonas.length} zonas)`);

      try {
        const resultado = await zonaService.iniciarSimulacionZona(
          { metricaClave, escenario, dias, intervalMinutos, intervalSimSeg, zonas: finalZonas },
          (tickPayload) => {
            io.emit('zona:tick', tickPayload);
            if (tickPayload.zonas && tickPayload.zonas.length > 0) {
              const notificacionesService = require('../notificaciones/notificaciones.service');
              tickPayload.zonas.forEach(z => {
                if (z.severidad === 'critica' || z.severidad === 'emergencia') {
                  notificacionesService.notifyAlertByCoordinates({
                    lat: z.centroide.lat,
                    lng: z.centroide.lng,
                    metrica: tickPayload.metricaClave,
                    valor: z.valor,
                    label: z.umbralLabel,
                    severidad: z.severidad,
                    source: `Simulación de Zona: ${z.nombre}`
                  }).catch(err => logger.error('[zona:tick] Error enviando alerta geográfica:', err.message));
                }
              });
            }
          },
          // onComplete: emitir estado cuando la simulación termina automáticamente
          () => {
            logger.info('📡 Emitiendo zona:estado { running: false } (auto-complete)');
            io.emit('zona:estado', { running: false });
          }
        );

        logger.info(`✅ Zonas iniciadas — sesionId: ${resultado.sesionId}`);
        io.emit('zona:estado', {
          running: true,
          sesionId: resultado.sesionId,
          totalLecturas: resultado.totalLecturas,
          fechaInicio: resultado.fechaInicio,
          metricaClave,
          escenarioNombre: (finalZonas[0] && finalZonas[0].escenario && finalZonas[0].escenario.nombre) || 'Simulación',
          zonas: resultado.zonas
        });

      } catch (err) {
        logger.error('[zona:iniciar] Error:', err.message);
        socket.emit('zona:error', { message: err.message });
      }
    });

    // ─── Detener simulación de zona ──────────────────────────────────────────
    socket.on('zona:detener', async () => {
      logger.info('⏹  Deteniendo simulación de zona');
      try {
        const stopped = await zonaService.detenerSimulacionZona();
        if (stopped) {
          io.emit('zona:estado', { running: false });
          logger.info('✅ Simulación de zona detenida');
        }
      } catch (err) {
        logger.error('[zona:detener] Error:', err.message);
        socket.emit('zona:error', { message: err.message });
      }
    });

  });
}

module.exports = { registerZonaSocketEvents };
