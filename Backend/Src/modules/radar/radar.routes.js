const express = require('express');
const pool = require('../../config/db');
const { getRadarData } = require('./radar.service');
const router = express.Router();

router.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/available-dates', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT forecast_time FROM radar_grid_cache ORDER BY forecast_time DESC');
    const dates = result.rows.map(r => r.forecast_time);
    res.json(dates);
  } catch (error) {
    console.error('Error detallado en available-dates:', error);
    res.status(500).json({ error: 'Error al obtener fechas disponibles: ' + error.message });
  }
});

router.get('/bolivia', async (req, res) => {
  try {
    const time = req.query.time || null;
    const data = await getRadarData(time);
    res.json(data);
  } catch (error) {
    console.error('Error fetching radar data:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener datos del radar' });
  }
});

router.get('/prediction', async (req, res) => {
  try {
    const { getAiRefinedRadar } = require('./weather_ai.service');
    const time = req.query.time || null;
    const data = await getAiRefinedRadar(time);
    res.json(data);
  } catch (error) {
    console.error('Error fetching AI prediction:', error);
    res.status(500).json({ error: 'Error interno en la predicción IA' });
  }
});

module.exports = router;
