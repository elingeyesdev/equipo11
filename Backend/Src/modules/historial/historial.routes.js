const express = require('express');
const router = express.Router();
const historialController = require('./historial.controller');
const { verificarToken } = require('../auth/auth.middleware');
const { validate } = require('../../middleware/validate');
const { seedHistorialSchema, historialQuerySchema } = require('./historial.schema');

router.get('/', validate(historialQuerySchema, 'query'), historialController.getHistorial);
router.get('/ciudad/:localidadId', historialController.getCiudadHistorial);
router.post('/seed', verificarToken, validate(seedHistorialSchema, 'body'), historialController.seedHistorial);
router.delete('/seed', verificarToken, historialController.clearHistorial);

module.exports = router;
