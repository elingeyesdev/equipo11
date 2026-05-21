const express = require('express');
const router = express.Router();
const simulacionController = require('./simulacion.controller');
const ESCENARIOS = require('../simulacion-zona/escenarios.data');
const { verificarToken } = require('../auth/auth.middleware');
const { validate } = require('../../middleware/validate');
const { simulateRangeSchema } = require('./simulacion.schema');
const { success, error } = require('../../utils/response');

router.post('/range', verificarToken, validate(simulateRangeSchema, 'body'), simulacionController.simulateRange);

router.get('/escenarios', (req, res) => {
  success(res, ESCENARIOS);
});

module.exports = router;
