const simulacionService = require('./simulacion.service');

const simulateRange = async (req, res) => {
  try {
    const { startTime, endTime, intervalMinutes } = req.body;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Faltan parámetros: startTime y endTime son requeridos.' });
    }

    const count = await simulacionService.simulateRange(startTime, endTime, intervalMinutes || 60);
    
    res.json({ 
      msg: 'Simulación completada con éxito.', 
      dataPointsPerCity: count,
      range: { startTime, endTime, intervalMinutes: intervalMinutes || 60 }
    });
  } catch (error) {
    console.error('[Simulación] Error en rango:', error.message);
    res.status(400).json({ error: error.message });
  }
};

module.exports = { simulateRange };
