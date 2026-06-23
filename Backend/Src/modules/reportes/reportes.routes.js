const express = require('express');
const { generarReporte } = require('./reportes.controller');
const { verificarToken } = require('../auth/auth.middleware');
const { validate } = require('../../middleware/validate');
const { generarReporteSchema } = require('./reportes.schema');
const { obtenerSugerenciaIA } = require('./reportes.ai');
const { generarRespuestaMeteoro } = require('./meteoro.service');
const { success, error } = require('../../utils/response');

const router = express.Router();

router.post('/generar', verificarToken, validate(generarReporteSchema, 'body'), generarReporte);
router.post('/ia', verificarToken, obtenerSugerenciaIA);

router.post('/meteoro', verificarToken, async (req, res) => {
    try {
        const { ciudad, prompt, datosContexto, mapContext } = req.body;
        if (!ciudad || !prompt) {
            return error(res, 'Faltan parámetros ciudad y prompt', 400);
        }
        
        const respuesta = await generarRespuestaMeteoro(ciudad, prompt, datosContexto || [], mapContext);
        success(res, respuesta);
    } catch (err) {
        error(res, err.message, 500);
    }
});

module.exports = router;
