const express = require('express');
const router = express.Router();
const { getSensoresCache, estimarDatosPuntoArbitrario } = require('./sensores.service');
const { estimateICA, estimateRuido } = require('../../utils/estimadores');
const { METRIC_LIMITS } = require('../../constants/metricas');
const { success, error } = require('../../utils/response');
const {
  crearSensorController,
  eliminarSensorController,
  getSensoresMqttController
} = require('./sensores.controller');
const { verificarToken } = require('../auth/auth.middleware');

/**
 * GET /api/sensores
 * Devuelve todos los sensores IoT con sus últimas lecturas reales desde caché.
 */
router.get('/', async (req, res) => {
  try {
    const sensores = await getSensoresCache();
    success(res, { count: sensores.length, data: sensores });
  } catch (err) {
    error(res, 'Error obteniendo sensores: ' + err.message, 500);
  }
});

/**
 * POST /api/sensores
 * Agrega un nuevo sensor MQTT administrado.
 */
router.post('/', verificarToken, crearSensorController);

/**
 * GET /api/sensores/mqtt
 * Obtiene todos los sensores MQTT configurados.
 */
router.get('/mqtt', verificarToken, getSensoresMqttController);

/**
 * DELETE /api/sensores/mqtt/:id
 * Elimina un sensor MQTT configurado.
 */
router.delete('/mqtt/:id', verificarToken, eliminarSensorController);

/**
 * GET /api/sensores/punto?lat=X&lng=Y
 * Estima datos ambientales para cualquier punto del mapa (clic del usuario).
 * Devuelve datos reales de clima + ICA y Ruido estimados de forma realista.
 */
router.get('/punto', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return error(res, 'Parámetros lat y lng requeridos y deben ser numéricos.', 400);
  }

  try {
    const datos = await estimarDatosPuntoArbitrario(lat, lng);
    success(res, datos);
  } catch (err) {
    error(res, 'Error estimando datos: ' + err.message, 500);
  }
});

/**
 * GET /api/sensores/estimaciones?ica=X&ruido=Y
 * Estima ICA y Ruido usando las fórmulas canónicas del backend.
 */
router.get('/estimaciones', (req, res) => {
  const { humedad, aqi, weatherCode } = req.query;
  const ranges = { ica: METRIC_LIMITS.ica, ruido: METRIC_LIMITS.ruido };

  const ica = humedad != null && aqi != null
    ? estimateICA(Number(humedad), Number(aqi), Number(weatherCode) || 0, { ica: [METRIC_LIMITS.ica.min, METRIC_LIMITS.ica.max] })
    : null;
  const ruido = estimateRuido({ ruido: [METRIC_LIMITS.ruido.min, METRIC_LIMITS.ruido.max] });

  success(res, { ica, ruido });
});

/**
 * GET /api/sensores/metricas-limites
 * Devuelve los límites canónicos de métricas (fuente única de verdad).
 */
router.get('/metricas-limites', (req, res) => {
  success(res, METRIC_LIMITS);
});

module.exports = router;
