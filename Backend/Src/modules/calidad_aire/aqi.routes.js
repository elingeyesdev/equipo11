const express = require('express');
const fs = require('fs');
const path = require('path');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

const AQI_FILE_PATH = path.join(process.cwd(), 'data', 'aqi', 'aqi_global.json');

router.get('/global', (req, res) => {
  try {
    if (!fs.existsSync(AQI_FILE_PATH)) {
      return error(res, 'Los datos de AQI global aún no están listos. El scraper está en proceso.', 404);
    }
    
    // Al ser un archivo estático precompilado, podemos leerlo y parsearlo
    // o enviarlo directamente usando res.sendFile
    // Enviaremos usando res.sendFile para mejor rendimiento
    res.sendFile(AQI_FILE_PATH, (err) => {
      if (err) {
        logger.error('[AQI Routes] Error enviando archivo:', err.message);
        // Si ya empezó a enviarse no podemos cambiar el status
        if (!res.headersSent) {
          res.status(500).json({ status: 'error', message: 'Error enviando datos AQI' });
        }
      }
    });
  } catch (err) {
    logger.error('[AQI Routes] Error procesando request:', err.message);
    error(res, 'Error interno del servidor', 500);
  }
});

module.exports = router;
