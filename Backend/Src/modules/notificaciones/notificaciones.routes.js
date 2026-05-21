const express = require('express');
const router = express.Router();
const controller = require('./notificaciones.controller');
const { verificarToken } = require('../auth/auth.middleware');

router.get('/', controller.getSettings);
router.put('/', verificarToken, controller.updateSettings);

module.exports = router;
