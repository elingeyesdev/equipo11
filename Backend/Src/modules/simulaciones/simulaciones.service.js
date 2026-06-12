const logger = require('../../utils/logger');

const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://prediction-service:8000';

async function fetchFromService(endpoint, options = {}) {
  const url = `${PREDICTION_SERVICE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Prediction Service HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err) {
    logger.error(`[Simulation Service] Error calling ${endpoint}: ${err.message}`);
    throw err;
  }
}

/**
 * Llama a prediction-service POST /simulate para crear la simulación
 */
async function createSimulation(data) {
  return await fetchFromService('/simulate', {
    method: 'POST',
    body: data,
  });
}

/**
 * Llama a prediction-service GET /simulate/{id} para obtener el detalle de una simulación
 */
async function getSimulation(id) {
  return await fetchFromService(`/simulate/${id}`, {
    method: 'GET',
  });
}

/**
 * Llama a prediction-service GET /simulate para listar simulaciones
 */
async function listSimulations() {
  return await fetchFromService('/simulate', {
    method: 'GET',
  });
}

/**
 * Llama a prediction-service DELETE /simulate/{id} para cancelar/finalizar una simulación
 */
async function cancelSimulation(id) {
  return await fetchFromService(`/simulate/${id}`, {
    method: 'DELETE',
  });
}

module.exports = {
  createSimulation,
  getSimulation,
  listSimulations,
  cancelSimulation,
};
