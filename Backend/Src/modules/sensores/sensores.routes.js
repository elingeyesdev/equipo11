const express = require('express');
const router = express.Router();
const { getSensoresCache, estimarDatosPuntoArbitrario } = require('./sensores.service');
const { estimateICA, estimateRuido } = require('../../utils/estimadores');
const { METRIC_LIMITS } = require('../../constants/metricas');

/**
 * GET /api/sensores
 * Devuelve todos los sensores IoT con sus últimas lecturas reales desde caché.
 */
router.get('/', async (req, res) => {
  try {
    const sensores = await getSensoresCache();
    res.json({ status: 'ok', count: sensores.length, data: sensores });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo sensores', detail: err.message });
  }
});

/**
 * GET /api/sensores/punto?lat=X&lng=Y
 * Estima datos ambientales para cualquier punto del mapa (clic del usuario).
 * Devuelve datos reales de clima + ICA y Ruido estimados de forma realista.
 */
router.get('/punto', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Parámetros lat y lng requeridos y deben ser numéricos.' });
  }

  try {
    const datos = await estimarDatosPuntoArbitrario(lat, lng);
    res.json({ status: 'ok', data: datos });
  } catch (err) {
    res.status(500).json({ error: 'Error estimando datos', detail: err.message });
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

  res.json({ ok: true, data: { ica, ruido } });
});

/**
 * GET /api/sensores/metricas-limites
 * Devuelve los límites canónicos de métricas (fuente única de verdad).
 */
router.get('/metricas-limites', (req, res) => {
  res.json({ ok: true, data: METRIC_LIMITS });
});

module.exports = router;
