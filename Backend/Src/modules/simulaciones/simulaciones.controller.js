const simulacionesService = require('./simulaciones.service');
const { createSimSchema } = require('./simulaciones.schema');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Crea una simulación validando los parámetros con Zod y enviándola al prediction-service
 */
async function postCreateSim(req, res) {
  try {
    const parseResult = createSimSchema.safeParse(req.body);
    if (!parseResult.success) {
      return error(res, 'Datos de entrada inválidos', 400, parseResult.error.flatten().fieldErrors);
    }
    
    // Añadimos el creador de la simulación a partir del token de autenticación (si está presente)
    const payload = {
      ...parseResult.data,
      creado_por: req.usuario ? req.usuario.id : null
    };

    const result = await simulacionesService.createSimulation(payload);
    return success(res, result, 'Simulación de escenario iniciada con éxito', 201);
  } catch (err) {
    logger.error(`[Simulation Controller] Error in postCreateSim: ${err.message}`);
    return error(res, err.message || 'Error al iniciar la simulación', 500);
  }
}

/**
 * Retorna el detalle, datos y alertas de una simulación por ID
 */
async function getSim(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return error(res, 'El ID de simulación debe ser numérico', 400);
    }
    
    const result = await simulacionesService.getSimulation(id);
    return success(res, result);
  } catch (err) {
    logger.error(`[Simulation Controller] Error in getSim: ${err.message}`);
    return error(res, err.message || 'Error al obtener el detalle de la simulación', 500);
  }
}

/**
 * Lista todas las simulaciones activas y pasadas del sistema
 */
async function listSims(req, res) {
  try {
    const result = await simulacionesService.listSimulations();
    return success(res, result);
  } catch (err) {
    logger.error(`[Simulation Controller] Error in listSims: ${err.message}`);
    return error(res, err.message || 'Error al listar las simulaciones', 500);
  }
}

/**
 * Cancela una simulación activa (cambia estado a 'cancelada')
 */
async function deleteSim(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return error(res, 'El ID de simulación debe ser numérico', 400);
    }
    
    const result = await simulacionesService.cancelSimulation(id);
    return success(res, result, 'Simulación cancelada con éxito');
  } catch (err) {
    logger.error(`[Simulation Controller] Error in deleteSim: ${err.message}`);
    return error(res, err.message || 'Error al cancelar la simulación', 500);
  }
}

module.exports = {
  postCreateSim,
  getSim,
  listSims,
  deleteSim
};
