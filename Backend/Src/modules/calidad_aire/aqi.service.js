const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);

const logger = require('../../utils/logger');
const { buildGEFSUrl } = require('../../utils/gefs_scraper');
const { pm25ToAqi } = require('../../utils/aqiMath');
const { generateGridKeys } = require('../radar/radar.service');

// Configuración de directorios de datos (Exclusivos para AQI)
const DATA_DIR = path.join(process.cwd(), 'data');
const AQI_DIR = path.join(DATA_DIR, 'aqi');

const initDirectories = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(AQI_DIR)) fs.mkdirSync(AQI_DIR, { recursive: true });
};

// Intenta encontrar la última URL de GFS válida
const getLatestGEFSUrl = async () => {
  const hours = ['18', '12', '06', '00'];
  const now = new Date();

  // Probar hoy y ayer
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - dayOffset);
    
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    for (const hour of hours) {
      const url = buildGEFSUrl(dateStr, hour, 'f000');
      logger.info(`[AQI Scraper] Probando URL exacta de GEFS: ${url}`);
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          return { url, dateStr, hour };
        } else {
          logger.warn(`[AQI Scraper] Error ${response.status} ${response.statusText} al intentar acceder a: ${url}`);
        }
      } catch (e) {
        logger.warn(`[AQI Scraper] Error de red conectando a NOMADS GEFS para ${dateStr} ${hour}z: ${e.message} (URL: ${url})`);
      }
    }
  }
  throw new Error("No se encontraron datos recientes de GEFS-Aerosol en la NOAA.");
};

// Extrae los datos de PM2.5 usando wgrib2
const extractPM25 = async (gribPath, gridKeys) => {
  // En GEFS-Aerosol, el PM2.5 superficial se suele identificar como PMTF (Particulate Matter Fine)
  // Intentamos con pmtf minúscula y mayúscula
  let shortName = 'pmtf';
  
  const tryExtract = async (nameToTry) => {
    let whereClause = `shortName=${nameToTry},typeOfLevel=surface`;
    const { stdout } = await execPromise(`grib_get_data -F "%.4f" -w ${whereClause} ${gribPath}`, { maxBuffer: 150 * 1024 * 1024 });
    const lines = stdout.split('\n');
    const data = new Map();

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 3) continue;

      const lat = parseFloat(parts[0]);
      let lon = parseFloat(parts[1]);
      const val = parseFloat(parts[2]);

      if (isNaN(lat) || isNaN(lon) || isNaN(val)) continue;
      if (val === 9999 || val <= -9999) continue;

      const key = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
      if (gridKeys.has(key)) {
        data.set(key, val);
      }
    }
    return data;
  };

  try {
    let data = await tryExtract(shortName.toLowerCase());
    if (data.size === 0) data = await tryExtract(shortName.toUpperCase());
    return data;
  } catch (err) {
    try {
      return await tryExtract(shortName.toUpperCase());
    } catch (e2) {
      logger.warn(`[AQI Scraper] No se pudo extraer PMTF. Intentando PM25: ${e2.message}`);
      // Fallback a PM25 por si el grib usa otra convención
      try {
        return await tryExtract('pm25');
      } catch (e3) {
        return new Map();
      }
    }
  }
};

let isScraping = false;

const runAqiScraper = async () => {
  if (isScraping) return;
  isScraping = true;

  try {
    logger.info('[AQI Scraper] Iniciando descarga de malla global GEFS-Aerosol (PM2.5)...');
    initDirectories();

    const { url, dateStr, hour } = await getLatestGEFSUrl();
    const gribFileName = `gefs_${dateStr}_${hour}_aqi.grib2`;
    const gribPath = path.join(AQI_DIR, gribFileName);
    const jsonPath = path.join(AQI_DIR, 'aqi_global.json');

    // Descargar GRIB si no existe
    if (!fs.existsSync(gribPath)) {
      logger.info(`[AQI Scraper] Descargando GRIB desde ${url}...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} - Falló la descarga final de: ${url}`);
      }
      const buffer = await response.arrayBuffer();
      
      const tempPath = gribPath + '.tmp';
      fs.writeFileSync(tempPath, Buffer.from(buffer));
      fs.renameSync(tempPath, gribPath);
      logger.info(`[AQI Scraper] GRIB guardado en ${gribPath}`);
    }

    // Extraer datos
    logger.info('[AQI Scraper] Extrayendo datos PM2.5...');
    const gridKeys = generateGridKeys();
    const mapPM25 = await extractPM25(gribPath, gridKeys);

    logger.info(`[AQI Scraper] Procesando ${mapPM25.size} puntos. Aplicando transformación AQI...`);
    const gridData = [];

    for (const key of gridKeys) {
      const pm25 = mapPM25.get(key);
      let aqiValue = null;

      if (pm25 !== undefined) {
        // El GRIB2 ya nos entrega los datos crudos en µg/m³. NO multiplicar por 1e9.
        aqiValue = pm25ToAqi(pm25);
      }

      let [latStr, lonStr] = key.split('_');
      let lat = parseFloat(latStr);
      let lon = parseFloat(lonStr);
      if (lon > 180) lon -= 360;

      gridData.push({
        lat,
        lon,
        aqi: aqiValue
      });
    }

    // Escribir JSON final para el Frontend
    const tempJsonPath = jsonPath + '.tmp';
    fs.writeFileSync(tempJsonPath, JSON.stringify(gridData));
    fs.renameSync(tempJsonPath, jsonPath);
    
    logger.info(`[AQI Scraper] ✅ Malla global AQI generada exitosamente: aqi_global.json con ${gridData.length} puntos.`);

  } catch (error) {
    logger.error('[AQI Scraper] Error fatal:', error.message);
  } finally {
    isScraping = false;
  }
};

let cronIntervalId = null;

const startAqiCron = () => {
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas (Ciclo GEFS)
  runAqiScraper(); // Ejecutar inmediatamente
  cronIntervalId = setInterval(runAqiScraper, INTERVAL_MS);
  logger.info('[AQI Scraper] 🔌 Cron iniciado — actualización cada 6 horas.');
};

const stopAqiCron = () => {
  if (cronIntervalId) {
    clearInterval(cronIntervalId);
    cronIntervalId = null;
    logger.info('[AQI Scraper] Cron detenido.');
  }
};

module.exports = {
  runAqiScraper,
  startAqiCron,
  stopAqiCron
};
