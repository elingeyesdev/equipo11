const express = require('express');
const { getRadarData } = require('./radar.service');
const router = express.Router();

router.get('/bolivia', async (req, res) => {
  try {
    const data = await getRadarData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching radar data:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener datos del radar' });
  }
});

module.exports = router;
