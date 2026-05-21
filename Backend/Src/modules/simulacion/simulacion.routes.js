const express = require('express');
const router = express.Router();
const simulacionController = require('./simulacion.controller');
const ESCENARIOS = require('../simulacion-zona/escenarios.data');
const { verificarToken } = require('../auth/auth.middleware');

router.post('/range', verificarToken, simulacionController.simulateRange);

router.get('/escenarios', (req, res) => {
  res.json({ ok: true, data: ESCENARIOS });
});

module.exports = router;
