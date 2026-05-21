const express = require('express');
const { generarReporte } = require('./reportes.controller');
const { verificarToken } = require('../auth/auth.middleware');

const router = express.Router();

router.post('/generar', verificarToken, generarReporte);

module.exports = router;
