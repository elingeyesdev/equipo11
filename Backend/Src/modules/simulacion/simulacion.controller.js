const simulacionService = require('./simulacion.service');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');

const simulateRange = async (req, res) => {
  try {
    const { startTime, endTime, intervalMinutes } = req.body;
    
    if (!startTime || !endTime) {
      return error(res, 'Faltan parámetros: startTime y endTime son requeridos.', 400);
    }

    const count = await simulacionService.simulateRange(startTime, endTime, intervalMinutes || 60);
    
    success(res, { 
      mensaje: 'Simulación completada con éxito.', 
      dataPointsPerCity: count,
      range: { startTime, endTime, intervalMinutes: intervalMinutes || 60 }
    });
  } catch (error) {
    logger.error('[Simulación] Error en rango:', error.message);
    error(res, error.message, 400);
  }
};

module.exports = { simulateRange };
