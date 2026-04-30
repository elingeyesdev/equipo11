const express = require('express');
const { generarReporte } = require('./reportes.controller');

const router = express.Router();

router.post('/generar', generarReporte);

module.exports = router;
