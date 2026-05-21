const express = require('express');
const { generarReporte } = require('./reportes.controller');
const { verificarToken } = require('../auth/auth.middleware');
const { validate } = require('../../middleware/validate');
const { generarReporteSchema } = require('./reportes.schema');

const router = express.Router();

router.post('/generar', verificarToken, validate(generarReporteSchema, 'body'), generarReporte);

module.exports = router;
