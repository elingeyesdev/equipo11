const express = require('express');
const router = express.Router();
const historialController = require('./historial.controller');

router.get('/', historialController.getHistorial);
router.get('/ciudad/:localidadId', historialController.getCiudadHistorial);
router.post('/seed', historialController.seedHistorial);
router.delete('/seed', historialController.clearHistorial);

module.exports = router;
