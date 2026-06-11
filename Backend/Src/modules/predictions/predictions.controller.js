const predictionsService = require('./predictions.service');
const pool = require('../../config/db');
const alertasService = require('../alertas/alertas.service');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

// Evaluador y persistente de alertas predictivas en Node.js (reutilizando alertas.service)
async function evaluatePredictiveAlerts(localidadId, predictionsDict) {
  try {
    const { rows } = await pool.query('SELECT nombre FROM localidades WHERE id = $1', [localidadId]);
    if (!rows[0]) return;
    const cityName = rows[0].nombre;

    // Eliminar alertas predictivas futuras obsoletas para esta localidad
    await pool.query(
      "DELETE FROM alertas WHERE tipo = 'prediccion' AND localidad_id = $1 AND tiempo >= NOW()",
      [localidadId]
    );

    const timeSteps = {};
    Object.entries(predictionsDict).forEach(([metric, list]) => {
      if (!list) return;
      list.forEach(p => {
        if (!timeSteps[p.tiempo]) timeSteps[p.tiempo] = {};
        timeSteps[p.tiempo][metric] = p.valor;
      });
    });

    const allAlerts = [];
    for (const [timestamp, data] of Object.entries(timeSteps)) {
      const tickData = {
        cities: [
          {
            name: cityName,
            data: data
          }
        ]
      };

      const alerts = await alertasService.evaluarTick(tickData);
      if (alerts && alerts.length > 0) {
        alerts.forEach(a => {
          a.tipo = 'prediccion';
          a.tiempo = timestamp;
          a.ciudad_nombre = cityName;
        });
        allAlerts.push(...alerts);
      }
    }

    if (allAlerts.length > 0) {
      await alertasService.guardarAlertas(allAlerts);
      logger.info(`[Predictions Controller] Evaluadas y persistidas ${allAlerts.length} alertas predictivas para ${cityName}.`);
    }
  } catch (err) {
    logger.error('[Predictions Controller] Error evaluando alertas predictivas:', err);
  }
}

async function getTrend(req, res) {
  try {
    const { localidad_id, metrica_clave, horas_prediccion } = req.body;
    const data = await predictionsService.getTrend(localidad_id, metrica_clave, horas_prediccion);
    
    // Evaluar alertas predictivas para la métrica solicitada
    if (data && data.predictions) {
      const singleMetricDict = { [metrica_clave]: data.predictions };
      await evaluatePredictiveAlerts(localidad_id, singleMetricDict);
    }
    
    return success(res, data);
  } catch (err) {
    logger.error('[Predictions Controller] Error in getTrend:', err);
    return error(res, 'Error al obtener la tendencia predictiva', 500);
  }
}

async function getCorrelations(req, res) {
  try {
    const { localidad_id } = req.body;
    const data = await predictionsService.getCorrelations(localidad_id);
    return success(res, data);
  } catch (err) {
    logger.error('[Predictions Controller] Error in getCorrelations:', err);
    return error(res, 'Error al obtener la matriz de correlaciones', 500);
  }
}

async function getScenario(req, res) {
  try {
    const { localidad_id, metrica_clave, horas_prediccion } = req.body;
    const data = await predictionsService.getScenario(localidad_id, metrica_clave, horas_prediccion);
    return success(res, data);
  } catch (err) {
    logger.error('[Predictions Controller] Error in getScenario:', err);
    return error(res, 'Error al simular los escenarios what-if', 500);
  }
}

async function getReport(req, res) {
  try {
    const { localidad_id, horas_prediccion } = req.body;
    const data = await predictionsService.getReport(localidad_id, horas_prediccion);
    
    // Evaluar alertas predictivas para todas las métricas reales simuladas
    if (data && data.predictions) {
      await evaluatePredictiveAlerts(localidad_id, data.predictions);
    }
    
    return success(res, data);
  } catch (err) {
    logger.error('[Predictions Controller] Error in getReport:', err);
    return error(res, 'Error al generar el reporte de decisión predictivo', 500);
  }
}

module.exports = {
  getTrend,
  getCorrelations,
  getScenario,
  getReport
};
