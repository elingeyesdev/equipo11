const express = require('express');
const router = express.Router();
const simulacionController = require('./simulacion.controller');

router.post('/range', simulacionController.simulateRange);

module.exports = router;
