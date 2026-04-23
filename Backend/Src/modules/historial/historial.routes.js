const express = require('express');
const router = express.Router();
const historialController = require('./historial.controller');

router.get('/', historialController.getHistorial);
router.post('/seed', historialController.seedHistorial);
router.delete('/seed', historialController.clearHistorial);

module.exports = router;
