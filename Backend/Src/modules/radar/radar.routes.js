const express = require('express');
const pool = require('../../config/db');
const { getRadarData } = require('./radar.service');
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
    const result = await pool.query('SELECT DISTINCT forecast_time FROM radar_grid_cache ORDER BY forecast_time DESC');
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
