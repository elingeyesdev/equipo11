const express = require('express');
const pool = require('../../config/db');
const {
  getRadarData, getRadarTempPng, getRadarVisPng, getRadarRainPng,
  getRadarAqiPng, getRadarSnowPng, getRadarWindPng, getRadarPointDetails
} = require('./radar.service');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');
const router = express.Router();

router.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    success(res, { time: result.rows[0].now });
  } catch (err) {
    error(res, err.message, 500);
  }
});

router.get('/available-dates', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT forecast_time FROM radar_grid_cache WHERE temperatura IS NOT NULL ORDER BY forecast_time DESC');
    const dates = result.rows.map(r => r.forecast_time);
    success(res, dates);
  } catch (err) {
    logger.error('Error detallado en available-dates:', err);
    error(res, 'Error al obtener fechas disponibles: ' + err.message, 500);
  }
});

router.get('/bolivia', async (req, res) => {
  try {
    const time = req.query.time || null;
    const data = await getRadarData(time);
    success(res, data);
  } catch (err) {
    logger.error('Error fetching radar data:', err);
    error(res, 'Error interno del servidor al obtener datos del radar', 500);
  }
});

// ─── Data Textures PNG: RGBA 360×180 (~5-20KB cada una) ─────────────
// Cada ruta retorna un PNG RGBA de 4 canales.
// El frontend las inyecta directamente en la GPU vía gl.texImage2D(gl.RGBA).

const _sendPng = (res, pngBuffer, layerName) => {
  res.set({
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=1800',
    'Content-Length': pngBuffer.length
  });
  res.send(pngBuffer);
};

router.get('/bolivia/temp/png', async (req, res) => {
  try {
    const pngBuffer = await getRadarTempPng(req.query.time || null);
    _sendPng(res, pngBuffer, 'temp');
  } catch (err) {
    logger.error('Error generating temp PNG:', err);
    error(res, 'Error generando Data Texture PNG de temperatura', 500);
  }
});

router.get('/bolivia/vis/png', async (req, res) => {
  try {
    const pngBuffer = await getRadarVisPng(req.query.time || null);
    _sendPng(res, pngBuffer, 'vis');
  } catch (err) {
    logger.error('Error generating vis PNG:', err);
    error(res, 'Error generando Data Texture PNG de visibilidad', 500);
  }
});

router.get('/bolivia/rain/png', async (req, res) => {
  try {
    const pngBuffer = await getRadarRainPng(req.query.time || null);
    _sendPng(res, pngBuffer, 'rain');
  } catch (err) {
    logger.error('Error generating rain PNG:', err);
    error(res, 'Error generando Data Texture PNG de lluvia', 500);
  }
});

router.get('/bolivia/aqi/png', async (req, res) => {
  try {
    const pngBuffer = await getRadarAqiPng();
    _sendPng(res, pngBuffer, 'aqi');
  } catch (err) {
    logger.error('Error generating AQI PNG:', err);
    error(res, 'Error generando Data Texture PNG de AQI', 500);
  }
});

router.get('/bolivia/snow/png', async (req, res) => {
  try {
    const pngBuffer = await getRadarSnowPng(req.query.time || null);
    _sendPng(res, pngBuffer, 'snow');
  } catch (err) {
    logger.error('Error generating snow PNG:', err);
    error(res, 'Error generando Data Texture PNG de nieve', 500);
  }
});

router.get('/bolivia/wind/png', async (req, res) => {
  try {
    const pngBuffer = await getRadarWindPng(req.query.time || null);
    _sendPng(res, pngBuffer, 'wind');
  } catch (err) {
    logger.error('Error generating wind PNG:', err);
    error(res, 'Error generando Data Texture PNG de viento', 500);
  }
});

// ─── Endpoint ligero: Detalles de un punto (~200 bytes) ─────────────
router.get('/bolivia/details', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return error(res, 'Parámetros lat y lon requeridos', 400);
    }
    const details = await getRadarPointDetails(lat, lon, req.query.time || null);
    if (!details) {
      return error(res, 'No hay datos disponibles para ese punto', 404);
    }
    success(res, details);
  } catch (err) {
    logger.error('Error fetching point details:', err);
    error(res, 'Error obteniendo detalles del punto', 500);
  }
});

router.get('/prediction', async (req, res) => {
  try {
    const { getAiRefinedRadar } = require('./weather_ai.service');
    const time = req.query.time || null;
    const data = await getAiRefinedRadar(time);
    success(res, data);
  } catch (err) {
    logger.error('Error fetching AI prediction:', err);
    error(res, 'Error interno en la predicción IA', 500);
  }
});

module.exports = router;
