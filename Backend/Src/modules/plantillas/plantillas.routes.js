const express = require('express');
const { crearPlantilla, obtenerPlantillas, eliminarPlantilla } = require('./plantillas.controller');
const { verificarToken } = require('../auth/auth.middleware');

const router = express.Router();

// Proteger todas las rutas de este router con JWT
router.use(verificarToken);

router.post('/', crearPlantilla);
router.get('/', obtenerPlantillas);
router.delete('/:id', eliminarPlantilla);

module.exports = router;
