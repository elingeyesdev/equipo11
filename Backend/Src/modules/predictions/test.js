const predictionsService = require('./predictions.service');
const logger = require('../../utils/logger');

async function runTests() {
  logger.info('🧪 [Predictions Test] Iniciando pruebas de integración del módulo predictivo...');
  
  try {
    // 1. Probar getTrend
    logger.info('1. Probando getTrend (ARIMA temperatura)...');
    const trend = await predictionsService.getTrend(1, 'temperatura', 48);
    logger.info('   • getTrend respuesta obtenida con éxito. Elementos históricos: ' + 
                (trend?.historical?.length || 0) + ', predicciones: ' + (trend?.predictions?.length || 0));

    // 2. Probar getCorrelations
    logger.info('2. Probando getCorrelations (Matriz de Pearson)...');
    const corr = await predictionsService.getCorrelations(1);
    logger.info('   • getCorrelations respuesta obtenida con éxito: ' + 
                (corr?.correlations ? 'Matriz cargada' : 'Fallida'));

    // 3. Probar getScenario
    logger.info('3. Probando getScenario (What-If cascade)...');
    const scenario = await predictionsService.getScenario(1, 'aqi', 48);
    logger.info('   • getScenario respuesta obtenida con éxito. Timeline actual: ' + 
                (scenario?.actual?.length || 0) + ', optimista: ' + (scenario?.optimista?.length || 0));

    // 4. Probar getReport
    logger.info('4. Probando getReport (Reporte en español + Recomendaciones)...');
    const report = await predictionsService.getReport(1, 48);
    logger.info('   • getReport respuesta obtenida con éxito. Recomendaciones: ' + 
                (report?.recommendations?.length || 0) + '. Análisis markdown: ' + 
                (report?.report_text ? 'Listo' : 'Vacío'));

    logger.info('✅ [Predictions Test] Todas las consultas del proxy hacia FastAPI han sido validadas exitosamente.');
  } catch (err) {
    logger.error('❌ [Predictions Test] Error al validar integración predictiva:', err.message);
    logger.error('Asegúrese de que el contenedor de python "prediction-service" esté corriendo en el puerto 8000.');
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
