const router = require('express').Router();
const controller = require('./simulaciones.controller');
const { verificarToken, verificarRol } = require('../auth/auth.middleware');

// Iniciar una simulación activa (solo admin y analista pueden crear)
router.post(
  '/',
  verificarToken,
  verificarRol(['admin', 'analista']),
  controller.postCreateSim
);

// Listar todas las simulaciones
router.get(
  '/',
  verificarToken,
  controller.listSims
);

// Detalle de una simulación por ID
router.get(
  '/:id',
  verificarToken,
  controller.getSim
);

// Cancelar una simulación (solo admin y analista pueden cancelar)
router.delete(
  '/:id',
  verificarToken,
  verificarRol(['admin', 'analista']),
  controller.deleteSim
);

module.exports = router;
