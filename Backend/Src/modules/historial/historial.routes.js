const express = require('express');
const router = express.Router();
const historialController = require('./historial.controller');
const { verificarToken } = require('../auth/auth.middleware');

router.get('/', historialController.getHistorial);
router.get('/ciudad/:localidadId', historialController.getCiudadHistorial);
router.post('/seed', verificarToken, historialController.seedHistorial);
router.delete('/seed', verificarToken, historialController.clearHistorial);

module.exports = router;
