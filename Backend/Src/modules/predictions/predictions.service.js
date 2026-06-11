const logger = require('../../utils/logger');

const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://prediction-service:8000';

async function fetchFromService(endpoint, body) {
  const url = `${PREDICTION_SERVICE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Prediction Service HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err) {
    logger.error(`[Predictions Service] Error calling ${endpoint}:`, err.message);
    throw err;
  }
}

async function getTrend(localidadId, metricaClave, horasPrediccion) {
  return await fetchFromService('/trend', {
    localidad_id: localidadId,
    metrica_clave: metricaClave,
    horas_prediccion: horasPrediccion,
  });
}

async function getCorrelations(localidadId) {
  return await fetchFromService('/correlations', {
    localidad_id: localidadId,
  });
}

async function getScenario(localidadId, metricaClave, horasPrediccion) {
  return await fetchFromService('/scenario', {
    localidad_id: localidadId,
    metrica_clave: metricaClave,
    horas_prediccion: horasPrediccion,
  });
}

async function getReport(localidadId, horasPrediccion) {
  return await fetchFromService('/report', {
    localidad_id: localidadId,
    horas_prediccion: horasPrediccion,
  });
}

async function triggerGridPrediction() {
  const url = `${PREDICTION_SERVICE_URL}/predict-grid`;
  try {
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Failed to trigger grid prediction: HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    logger.warn('[Predictions Service] Could not trigger grid prediction:', err.message);
    // No arrojamos el error para evitar tumbar el flujo principal del scraper
    return null;
  }
}

module.exports = {
  getTrend,
  getCorrelations,
  getScenario,
  getReport,
  triggerGridPrediction
};
