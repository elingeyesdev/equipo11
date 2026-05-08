const express = require('express');
const { getRadarData } = require('./radar.service');
const router = express.Router();

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

module.exports = router;
