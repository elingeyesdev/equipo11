const express = require('express');
const router = express.Router();
const controller = require('./notificaciones.controller');
const { verificarToken } = require('../auth/auth.middleware');

router.get('/', controller.getSettings);
router.put('/', verificarToken, controller.updateSettings);
router.post('/subscribe', verificarToken, controller.subscribe);
router.post('/unsubscribe', verificarToken, controller.unsubscribe);

module.exports = router;
