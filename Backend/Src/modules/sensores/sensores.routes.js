const express = require('express');
const router = express.Router();
const { getSensoresCache, estimarDatosPuntoArbitrario } = require('./sensores.service');
const { estimateICA, estimateRuido } = require('../../utils/estimadores');
const { METRIC_LIMITS } = require('../../constants/metricas');
const { success, error } = require('../../utils/response');

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

/**
 * POST /api/sensores
 * Crea o actualiza un sensor IoT personalizado.
 */
router.post('/', async (req, res) => {
  const { id, name, latitude, longitude, topics } = req.body;

  if (!id || !name || latitude === undefined || longitude === undefined || !topics) {
    return error(res, 'ID, nombre, latitud, longitud y topics son requeridos.', 400);
  }

  // Validar que al menos un tema esté configurado y no vacío
  const topicValues = Object.values(topics).filter(t => t && t.trim() !== '');
  if (topicValues.length === 0) {
    return error(res, 'Se requiere al menos un tema configurado para guardar el sensor.', 400);
  }

  try {
    const pool = require('../../config/db');
    const { rows } = await pool.query(`
      INSERT INTO sensores_cache (sensor_id, nombre, latitud, longitud, es_custom, topics)
      VALUES ($1, $2, $3, $4, TRUE, $5)
      ON CONFLICT (sensor_id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        latitud = EXCLUDED.latitud,
        longitud = EXCLUDED.longitud,
        topics = EXCLUDED.topics
      RETURNING sensor_id AS id, nombre AS name, latitud AS latitude, longitud AS longitude, es_custom, topics
    `, [id, name, parseFloat(latitude), parseFloat(longitude), JSON.stringify(topics)]);

    const { reloadSubscriptions } = require('./mqtt.service');
    await reloadSubscriptions();

    success(res, rows[0], 201);
  } catch (err) {
    error(res, 'Error al guardar el sensor IoT: ' + err.message, 500);
  }
});

/**
 * DELETE /api/sensores/:id
 * Elimina un sensor IoT personalizado.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = require('../../config/db');
    const { rows } = await pool.query(`
      DELETE FROM sensores_cache
      WHERE sensor_id = $1 AND es_custom = TRUE
      RETURNING sensor_id AS id
    `, [id]);

    if (rows.length === 0) {
      // Retornar éxito de forma idempotente para evitar errores de doble clic
      return success(res, { mensaje: 'El sensor ya había sido eliminado o no existía.', id });
    }

    const { reloadSubscriptions } = require('./mqtt.service');
    await reloadSubscriptions();

    success(res, { mensaje: 'Sensor IoT eliminado correctamente', id: rows[0].id });
  } catch (err) {
    error(res, 'Error al eliminar el sensor IoT: ' + err.message, 500);
  }
});

module.exports = router;
