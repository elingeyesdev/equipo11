const { spawn } = require('child_process');
const path = require('path');
const logger = require('../../utils/logger');

const PIPELINE_DIR = path.join(process.cwd(), 'services', 'data_pipeline');

/**
 * Ejecuta un script de Python de manera asincrónica.
 * @param {string} scriptName - Nombre del archivo .py a ejecutar
 * @param {string[]} args - Argumentos para el script
 */
const runPythonPipeline = (scriptName, args = []) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PIPELINE_DIR, scriptName);
    logger.info(`[Pipeline] Iniciando script: ${scriptName}`);
    
    // Asumimos que `python3` está disponible (como se configuró en el entorno Alpine)
    const pythonProcess = spawn('python3', [scriptPath, ...args]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        logger.info(`[Pipeline] ${scriptName} finalizó exitosamente.`);
        resolve(stdoutData);
      } else {
        logger.error(`[Pipeline] Error en ${scriptName} (Exit code: ${code}): ${stderrData}`);
        reject(new Error(`El script ${scriptName} falló con código ${code}`));
      }
    });
  });
};

module.exports = {
  runPythonPipeline
};
