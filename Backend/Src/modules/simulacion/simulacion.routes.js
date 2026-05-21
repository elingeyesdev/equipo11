const express = require('express');
const router = express.Router();
const simulacionController = require('./simulacion.controller');
const ESCENARIOS = require('../simulacion-zona/escenarios.data');

router.post('/range', simulacionController.simulateRange);

router.get('/escenarios', (req, res) => {
  res.json({ ok: true, data: ESCENARIOS });
});

module.exports = router;
