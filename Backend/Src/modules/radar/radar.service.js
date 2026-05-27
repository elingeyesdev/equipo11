const pool = require('../../config/db');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const logger = require('../../utils/logger');
const { buildNOAAUrl } = require('../../utils/noaa');

// Configuración de directorios de datos (Persistentes)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_RAW_DIR = path.join(DATA_DIR, 'raw');
const DATA_PROCESSED_DIR = path.join(DATA_DIR, 'Processed');
const DATA_HIST_RAW_DIR = path.join(DATA_DIR, 'HistoricalPredictions', 'raw');
const DATA_HIST_PROCESSED_DIR = path.join(DATA_DIR, 'HistoricalPredictions', 'Processed');

// Asegurar que existan los directorios
const initDirectories = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_RAW_DIR)) fs.mkdirSync(DATA_RAW_DIR, { recursive: true });
  if (!fs.existsSync(DATA_PROCESSED_DIR)) fs.mkdirSync(DATA_PROCESSED_DIR, { recursive: true });
  if (!fs.existsSync(DATA_HIST_RAW_DIR)) fs.mkdirSync(DATA_HIST_RAW_DIR, { recursive: true });
  if (!fs.existsSync(DATA_HIST_PROCESSED_DIR)) fs.mkdirSync(DATA_HIST_PROCESSED_DIR, { recursive: true });
  logger.info(`[Radar Scraper] Directorios de datos inicializados.`);
};

let isScraping = false;
let scrapeProgress = 0; // 0 a 100

const GLOBAL_BBOX = {
  north: 90.0,
  south: -90.0,
  west: 0.0,
  east: 359.0
};

const generateGridKeys = () => {
  const step = 1.0;
  const keys = new Set();
  let lat = Math.floor(GLOBAL_BBOX.south / step) * step;

  while (lat <= GLOBAL_BBOX.north) {
    let lng = Math.floor(GLOBAL_BBOX.west / step) * step;
    while (lng <= GLOBAL_BBOX.east) {
      // GFS outputs 0.25 resolution. Our points are exactly at .25 or .75 intervals
      const gridLat = (lat + (step / 2)).toFixed(2);
      let gridLng = (lng + (step / 2));
      // GFS output longitudes are 0-360
      let gfsLng = gridLng < 0 ? gridLng + 360 : gridLng;
      const key = `${gridLat}_${gfsLng.toFixed(2)}`;
      keys.add(key);
      lng += step;
    }
    lat += step;
  }
  return keys;
};

const getNOAAUrlForDate = async (dateObj, hour) => {
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  // Solicitamos f001 en lugar de f000. La precipitación (PRATE) no existe en f000 porque es acumulada.
  const url = buildNOAAUrl(dateStr, hour, 'f001');

  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      return { url, dateStr, hour };
    }
  } catch (e) {
    logger.warn(`[Radar Scraper] Error conectando a NOMADS para ${dateStr} ${hour}z: ${e.message}`);
  }
  return null;
};

const getLatestNOAAUrl = async () => {
  const hours = ['18', '12', '06', '00'];
  const now = new Date();

  // Probar hoy y ayer
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - dayOffset);
    for (const hour of hours) {
      const result = await getNOAAUrlForDate(d, hour);
      if (result) return result;
    }
  }
  throw new Error("No se encontraron datos recientes de GFS en la NOAA.");
};

const extractGribData = async (gribPath, shortName, gridKeys) => {
  const tryExtract = async (nameToTry) => {
    let whereClause = `shortName=${nameToTry}`;
    if (['prate', 'crain', 'csnow', 'PRATE', 'CRAIN', 'CSNOW'].includes(nameToTry)) {
      whereClause += `,stepType=avg`;
    } else if (['sdwe', 'SDWE'].includes(nameToTry)) {
      whereClause += `,stepType=instant`;
    }

    // Usamos %.6f en lugar de %.2f para evitar que ecCodes redondee a 0 los valores diminutos de PRATE (ej. 0.0083 mm/s)
    const { stdout } = await execPromise(`grib_get_data -F "%.6f" -w ${whereClause} ${gribPath}`, { maxBuffer: 50 * 1024 * 1024 });
    const lines = stdout.split('\n');
    const data = new Map();

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 3) continue;

      const lat = parseFloat(parts[0]);
      let lon = parseFloat(parts[1]);
      const val = parseFloat(parts[2]);

      // Los valores faltantes en NOAA GFS suelen ser exactamente 9999.0
      // Usar val >= 999 destruía datos válidos como Presión (101325 Pa) o CAPE.
      if (val === 9999 || val <= -9999) continue;

      // FORMATEO ESTRICTO: A 2 decimales, tal como se hace en generateGridKeys
      const key = `${lat.toFixed(2)}_${lon.toFixed(2)}`;

      if (gridKeys.has(key)) {
        data.set(key, val);
      }
    }

    // Inyección de log crítico de auditoría
    console.log(`[DEBUG GRIB] Extracción exitosa. Llaves en el Map: ${data.size}. Ejemplo de llave: ${Array.from(data.keys())[0]}`);
    return data;
  };

  try {
    // BUG REAL: grib_get_data no lanza error si el shortName no existe, solo devuelve headers.
    // Por lo tanto, el viejo try/catch nunca ejecutaba el fallback a mayúsculas si fallaba silenciosamente.
    let data = await tryExtract(shortName.toLowerCase());

    // Si devolvió un Map vacío, forzamos el intento en mayúsculas (crucial para PRATE o 10U)
    if (data.size === 0) {
      data = await tryExtract(shortName.toUpperCase());
    }

    logger.info(`[Radar Scraper] Extracción ${shortName} -> Keys coincidentes: ${data.size}`);
    return data;
  } catch (err) {
    // Si el comando falla por error de consola, intentamos el fallback
    try {
      const data = await tryExtract(shortName.toUpperCase());
      logger.info(`[Radar Scraper] Extracción ${shortName} -> Keys coincidentes: ${data.size}`);
      return data;
    } catch (e2) {
      logger.warn(`[Radar Scraper] Warning: No se pudo extraer ${shortName}. ${e2.message}`);
      return new Map();
    }
  }
};

// Table creation moved down

const processGribForUrl = async (url, dateStr, hourStr, forecastTimeStr, isBackground = false) => {
  // Extraer explícitamente el offset de la URL para evitar colisiones de caché
  const offsetMatch = url.match(/pgrb2\.0p25\.(f\d{3})/);
  const offset = offsetMatch ? offsetMatch[1] : 'f001';

  // Limpiar la hora si venía sucia de scrapeFutureForecasts (ej. '12_f003')
  const hour = hourStr.includes('_') ? hourStr.split('_')[0] : hourStr;

  const jsonFileName = `gfs_${dateStr}_${hour}_${offset}.json`;
  const jsonPath = path.join(DATA_PROCESSED_DIR, jsonFileName);
  const gribFileNameBase = `gfs_${dateStr}_${hour}_${offset}_base.grib2`;
  const gribPathBase = path.join(DATA_RAW_DIR, gribFileNameBase);
  const gribFileNameRain = `gfs_${dateStr}_${hour}_${offset}_rain.grib2`;
  const gribPathRain = path.join(DATA_RAW_DIR, gribFileNameRain);

  try {
    let gridData = [];

    // 1. Intentar cargar desde Caché Procesada (JSON)
    if (fs.existsSync(jsonPath)) {
      logger.info(`[Radar Scraper] Encontrada caché procesada (JSON): ${jsonFileName}. Cargando...`);
      const rawJson = fs.readFileSync(jsonPath, 'utf8');
      gridData = JSON.parse(rawJson);
    } else {
      // 2. Si no hay JSON, procesar GRIB
      const downloadGrib = async (targetUrl, targetPath) => {
        if (fs.existsSync(targetPath)) {
          logger.info(`[Radar Scraper] El archivo GRIB ${path.basename(targetPath)} ya existe localmente.`);
          return;
        }

        const tempPath = targetPath + '.tmp';
        const MAX_RETRIES = 3;
        let downloaded = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            logger.info(`[Radar Scraper] Descargando GRIB (${path.basename(targetPath)}) desde NOAA (intento ${attempt}/${MAX_RETRIES})...`);
            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const buffer = await response.arrayBuffer();

            // Validar que el archivo no esté vacío o truncado
            if (buffer.byteLength < 1000) {
              throw new Error(`Archivo GRIB sospechosamente pequeño: ${buffer.byteLength} bytes`);
            }

            // Escribir a archivo temporal primero
            fs.writeFileSync(tempPath, Buffer.from(buffer));

            // Renombrado atómico
            fs.renameSync(tempPath, targetPath);
            logger.info(`[Radar Scraper] GRIB guardado atómicamente en ${targetPath} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB).`);
            downloaded = true;
            break;
          } catch (dlErr) {
            logger.warn(`[Radar Scraper] Intento ${attempt}/${MAX_RETRIES} falló: ${dlErr.message}`);
            // Limpiar archivo temporal si quedó a medias
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) { }

            if (attempt < MAX_RETRIES) {
              const delay = attempt * 2000; // Backoff exponencial: 2s, 4s
              logger.info(`[Radar Scraper] Reintentando en ${delay / 1000}s...`);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }

        if (!downloaded) {
          throw new Error(`Fallo definitivo: No se pudo descargar el GRIB tras ${MAX_RETRIES} intentos.`);
        }
      };

      const urlBase = buildNOAAUrl(dateStr, hour, offset, 'base');
      const urlRain = buildNOAAUrl(dateStr, hour, offset, 'rain');

      // Descargas secuenciales para no asfixiar el servidor de NOAA
      await downloadGrib(urlBase, gribPathBase);
      await downloadGrib(urlRain, gribPathRain);

      logger.info(`[Radar Scraper] Extrayendo datos de los GRIBs...`);
      if (!isBackground) scrapeProgress = 40;
      const gridKeys = generateGridKeys();

      // Enrutador de variables a sus respectivos archivos
      const getPathForVar = (varName) => {
        return ['prate', 'crain', 'csnow', 'sdwe'].includes(varName) ? gribPathRain : gribPathBase;
      };

      // Autopsia del GRIB
      try {
        const { stdout: lsOut } = await execPromise(`grib_ls -p shortName,name,stepType ${gribPathRain}`);
        logger.info(`[DEBUG GRIB LS] Contenido de rain.grib2:\n${lsOut}`);
      } catch (e) {
        logger.error(`[DEBUG GRIB LS] Error: ${e.message}`);
      }

      const [mapU, mapV, mapGust, mapPress, mapRain, mapSnow, mapVis, mapCape, mapHlcy, mapRefc, mapPrate, mapSdwe, mapTemp, mapOzone] = await Promise.all([
        extractGribData(getPathForVar('10u'), '10u', gridKeys),
        extractGribData(getPathForVar('10v'), '10v', gridKeys),
        extractGribData(getPathForVar('gust'), 'gust', gridKeys),
        extractGribData(getPathForVar('prmsl'), 'prmsl', gridKeys),
        extractGribData(getPathForVar('crain'), 'crain', gridKeys),
        extractGribData(getPathForVar('csnow'), 'csnow', gridKeys),
        extractGribData(getPathForVar('vis'), 'vis', gridKeys),
        extractGribData(getPathForVar('cape'), 'cape', gridKeys),
        extractGribData(getPathForVar('hlcy'), 'hlcy', gridKeys),
        extractGribData(getPathForVar('refc'), 'refc', gridKeys),
        extractGribData(getPathForVar('prate'), 'prate', gridKeys),
        extractGribData(getPathForVar('sdwe'), 'sdwe', gridKeys),
        extractGribData(getPathForVar('2t'), '2t', gridKeys), // ecCodes: 2t = Temperature at 2m
        extractGribData(getPathForVar('tozne'), 'tozne', gridKeys) // ecCodes: tozne = Total Ozone
      ]);

      logger.info(`[Radar Scraper] Calculando vectores para ${forecastTimeStr}...`);
      if (!isBackground) scrapeProgress = 70;

      for (const key of gridKeys) {
        if (mapU.has(key) && mapV.has(key)) {
          const u = mapU.get(key);
          const v = mapV.get(key);
          const gustMs = mapGust.get(key) || 0;
          const pressPa = mapPress.get(key) || 101325;

          let wCode = null;
          if (mapSnow.get(key) === 1) wCode = 71;
          else if (mapRain.get(key) === 1) wCode = 61;
          else if (mapVis.has(key) && mapVis.get(key) < 2000) wCode = 45;

          const cape = mapCape.get(key) || 0;
          const hlcy = mapHlcy.get(key) || 0;
          const refc = mapRefc.get(key) || 0;
          let prate = mapPrate.get(key) || 0;
          if (prate >= 999 || prate < 0) prate = 0;
          const rainMmH = prate * 3600;

          let sdwe = mapSdwe.get(key) || 0;
          if (sdwe >= 999 || sdwe < 0) sdwe = 0;
          // SDWE en kg/m2 (mm) * 10 = cm de nieve
          const snowCm = sdwe * 10;

          // Nieve fresca (snow_fresh): (prate * 3600) mm/h * csnow * 10 = cm/h
          const csnow = mapSnow.get(key) || 0;
          const snowFreshCm = rainMmH * csnow * 10;

          const speedKmH = Math.sqrt(u * u + v * v) * 3.6;
          let dirDeg = 270 - (Math.atan2(v, u) * (180 / Math.PI));
          dirDeg = Math.round((dirDeg + 360) % 360);

          let [latStr, lonStr] = key.split('_');
          let lat = parseFloat(latStr);
          let lon = parseFloat(lonStr);
          if (lon > 180) lon -= 360;

          let visValue = mapVis.get(key);
          if (visValue === undefined || visValue < 0) visValue = null; // null explícito para pg

          let tempValue = mapTemp.get(key);
          if (tempValue === undefined) tempValue = null;

          let ozoneValue = mapOzone.get(key);
          if (ozoneValue === undefined) ozoneValue = null;

          gridData.push({
            lat, lon,
            wCode,
            speed: Number(speedKmH.toFixed(2)),
            dir: dirDeg,
            gust: Number((gustMs * 3.6).toFixed(2)),
            press: Number((pressPa / 100).toFixed(2)),
            cape: Number(cape.toFixed(2)),
            hlcy: Number(hlcy.toFixed(2)),
            refc: Number(refc.toFixed(2)),
            rain: Number(rainMmH.toFixed(2)),
            snow: Number(snowCm.toFixed(2)),
            snow_fresh: Number(snowFreshCm.toFixed(2)),
            vis: visValue !== null ? Number(visValue.toFixed(2)) : null,
            temperatura: tempValue !== null ? Number(tempValue.toFixed(2)) : null,
            ozono: ozoneValue !== null ? Number(ozoneValue.toFixed(2)) : null
          });
        }
      }

      // Guardar JSON con escritura atómica (protege contra cortes)
      const tempJsonPath = jsonPath + '.tmp';
      fs.writeFileSync(tempJsonPath, JSON.stringify(gridData));
      fs.renameSync(tempJsonPath, jsonPath);
      logger.info(`[Radar Scraper] Caché JSON creada atómicamente: ${jsonFileName}`);
    }

    // 3. Insertar en Base de Datos (Bulk Insert para velocidad)
    logger.info(`[Radar Scraper] Insertando ${gridData.length} nodos en la base de datos...`);
    await pool.query('DELETE FROM radar_grid_cache WHERE forecast_time = $1', [forecastTimeStr]);

    // Dividir en chunks para no saturar la conexión
    const chunkSize = 3000;
    for (let i = 0; i < gridData.length; i += chunkSize) {
      const chunk = gridData.slice(i, i + chunkSize);
      const values = [];
      const placeholders = chunk.map((p, idx) => {
        const offset = idx * 16;
        const tempVal = p.temperatura !== undefined ? p.temperatura : null;
        values.push(p.lat, p.lon, p.wCode, tempVal, p.speed, p.dir, p.gust, p.press, forecastTimeStr, p.cape, p.hlcy, p.refc, p.rain, p.snow, p.snow_fresh, p.vis);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16})`;
      }).join(',');

      try {
        await pool.query(
          `INSERT INTO radar_grid_cache (latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion, forecast_time, cape, hlcy, refc, rain, snow, snow_fresh, vis)
                   VALUES ${placeholders}
                   ON CONFLICT (latitud, longitud, forecast_time) DO NOTHING`,
          values
        );
      } catch (error) {
        logger.error("[CRÍTICO DB] Fallo en la inserción de PostgreSQL: " + error.message);
        throw error; // Para detener el proceso de esta fecha
      }
    }

    logger.info(`[Radar Scraper] ✅ Completado ${forecastTimeStr}.`);
  } catch (err) {
    logger.error(`[Radar Scraper] ❌ Error procesando ${forecastTimeStr}: \n${err.stack}`);
  }
};

let isScrapingHistory = false;

const scrapeHistoricalBackground = async () => {
  if (isScrapingHistory) return;
  isScrapingHistory = true;

  try {
    const { collectTrainingData } = require('./weather_history.service');
    await collectTrainingData(7); // Bajar 7 días de entrenamiento

    logger.info('[Radar Scraper] Iniciando descarga en segundo plano del histórico (últimos 3 días)...');

    const hours = ['00', '06', '12', '18'];
    const now = new Date();

    // Recorrer los últimos 3 días
    for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - dayOffset);
      for (const hour of hours) {
        const result = await getNOAAUrlForDate(d, hour);
        if (result) {
          const { url, dateStr, hour: h } = result;
          const forecastTimeStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${h}:00:00Z`;

          // Verificar si ya tenemos esta fecha en caché para no volver a descargar
          const check = await pool.query('SELECT 1 FROM radar_grid_cache WHERE forecast_time = $1 LIMIT 1', [forecastTimeStr]);
          if (check.rowCount === 0) {
            await processGribForUrl(url, dateStr, h, forecastTimeStr, true);
          }
        }
      }
    }
    logger.info('[Radar Scraper] Histórico descargado exitosamente.');
  } catch (err) {
    logger.error('[Radar Scraper] Error en histórico de fondo:', err);
  } finally {
    isScrapingHistory = false;
  }
};

const runScraper = async () => {
  if (isScraping) return;
  isScraping = true;
  scrapeProgress = 0;

  try {
    logger.info('[Radar Scraper] Iniciando sistema Bulk Data GRIB2 de NOAA...');

    // Migraciones para tablas existentes (initDb se encarga de la creación inicial)

    // ────────────────────────────────────────────────────────────
    // Schema migration helper: agrega una columna de manera segura
    // usando IF NOT EXISTS nativo de PostgreSQL (evita race conditions)
    // ────────────────────────────────────────────────────────────
    const ensureColumn = async (table, colDef) => {
      try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${colDef}`);
        logger.info(`[Radar Scraper] Columna asegurada: ${table}.${colDef.split(' ')[0]}`);
      } catch (err) {
        logger.warn(`[Radar Scraper] No se pudo asegurar columna ${table}: ${err.message}`);
      }
    };

    // Asegurar columnas de radar_grid_cache
    await ensureColumn('radar_grid_cache', 'wind_speed DECIMAL(5,2)');
    await ensureColumn('radar_grid_cache', 'wind_direction INT');
    await ensureColumn('radar_grid_cache', 'rafagas DECIMAL(5,2)');
    await ensureColumn('radar_grid_cache', 'presion DECIMAL(6,2)');
    await ensureColumn('radar_grid_cache', 'cape DECIMAL(8,2)');
    await ensureColumn('radar_grid_cache', 'hlcy DECIMAL(8,2)');
    await ensureColumn('radar_grid_cache', 'refc DECIMAL(8,2)');
    await ensureColumn('radar_grid_cache', 'rain DECIMAL(8,2)');
    await ensureColumn('radar_grid_cache', 'snow DECIMAL(8,2)');
    await ensureColumn('radar_grid_cache', 'snow_fresh DECIMAL(8,2)');
    await ensureColumn('radar_grid_cache', 'vis DECIMAL(8,2)');
    // Asegurar columnas de sensores_cache
    await ensureColumn('sensores_cache', 'wind_speed DECIMAL(5,2)');
    await ensureColumn('sensores_cache', 'wind_direction INT');

    try {
      // Intentar agregar forecast_time y actualizar PK si es necesario
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN IF NOT EXISTS forecast_time TIMESTAMPTZ DEFAULT NOW()');

      // Obtener el nombre de la constraint de la primary key de forma dinámica
      const pkConstraintRes = await pool.query(`
        SELECT conname 
        FROM pg_index i
        JOIN pg_constraint c ON c.conindid = i.indexrelid
        WHERE i.indrelid = 'radar_grid_cache'::regclass AND i.indisprimary;
      `);

      if (pkConstraintRes.rowCount > 0) {
        const constraintName = pkConstraintRes.rows[0].conname;
        // Si la PK actual no tiene 3 columnas (lat, lon, forecast_time), la recreamos
        const pkColsRes = await pool.query(`
          SELECT count(*) 
          FROM pg_attribute 
          WHERE attrelid = 'radar_grid_cache'::regclass 
          AND attnum = ANY((SELECT indkey FROM pg_index WHERE indrelid = 'radar_grid_cache'::regclass AND indisprimary)::int2[])
        `);

        if (parseInt(pkColsRes.rows[0].count) < 3) {
          logger.info(`[Radar Scraper] Actualizando Primary Key de radar_grid_cache (de ${pkColsRes.rows[0].count} a 3 columnas)...`);
          await pool.query(`ALTER TABLE radar_grid_cache DROP CONSTRAINT ${constraintName}`);
          await pool.query('ALTER TABLE radar_grid_cache ADD PRIMARY KEY (latitud, longitud, forecast_time)');
        }
      }
    } catch (e) {
      logger.warn('[Radar Scraper] Warning en migración de PK:', e.message);
    }

    logger.info('[Radar Scraper] Buscando último modelo GFS mundial...');
    initDirectories(); // Asegurar carpetas antes de procesar
    const result = await getLatestNOAAUrl();
    const { url, dateStr, hour } = result;
    const forecastTimeStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${hour}:00:00Z`;

    scrapeProgress = 10;
    await processGribForUrl(url, dateStr, hour, forecastTimeStr, false);

  } catch (error) {
    logger.error('[Radar Scraper] Error fatal Bulk Data:', error);
  } finally {
    isScraping = false;
    scrapeProgress = 100;

    // Disparar en background la obtención del histórico y el FORECAST (IA)
    setTimeout(scrapeHistoricalBackground, 2000);
    setTimeout(scrapeFutureForecasts, 5000);
  }
};

/**
 * Descarga y procesa los pronósticos para las próximas 24h (f003, f006, f009, f012)
 */
const scrapeFutureForecasts = async () => {
  logger.info('[Radar Scraper] Iniciando descarga de pronósticos futuros para IA...');
  const result = await getLatestNOAAUrl(); // Usar el ciclo más reciente
  const { dateStr, hour } = result;

  // Offsets a descargar: cada 3 horas hasta las 24h
  const offsets = ['f003', 'f006', 'f009', 'f012', 'f015', 'f018', 'f021', 'f024'];

  for (const offset of offsets) {
    const url = buildNOAAUrl(dateStr, hour, offset);

    // Calcular el tiempo de este forecast
    const offsetHours = parseInt(offset.substring(1));
    const baseDate = new Date(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${hour}:00:00Z`);
    const forecastDate = new Date(baseDate.getTime() + offsetHours * 60 * 60 * 1000);
    const forecastTimeStr = forecastDate.toISOString();

    // Verificar si ya existe para no repetir
    const check = await pool.query('SELECT 1 FROM radar_grid_cache WHERE forecast_time = $1 LIMIT 1', [forecastTimeStr]);
    if (check.rowCount === 0) {
      // Usamos una carpeta distinta para indicar que es forecast? 
      // Por ahora a la misma tabla pero podemos marcarla como "IA" luego
      await processGribForUrl(url, dateStr, `${hour}_${offset}`, forecastTimeStr, true);
    }
  }
  logger.info('[Radar Scraper] Pronósticos futuros completados.');
};

const getRadarData = async (targetTime = null) => {
  if (isScraping && !targetTime) {
    return { status: 'loading', progress: scrapeProgress };
  }

  let query = 'SELECT latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion, forecast_time, cape, hlcy, refc, rain, snow, snow_fresh, vis FROM radar_grid_cache';
  let params = [];

  if (targetTime) {
    // Buscar la cuadrícula con el forecast_time más cercano a targetTime
    query += ` WHERE forecast_time = (
        SELECT forecast_time FROM radar_grid_cache 
        ORDER BY ABS(EXTRACT(EPOCH FROM (forecast_time - $1::timestamp))) ASC 
        LIMIT 1
    )`;
    params.push(targetTime);
  } else {
    // Si no hay targetTime, devolver el más cercano a la hora actual (NOW)
    // Usar MAX traería la predicción más lejana en el futuro.
    query += ` WHERE forecast_time = (
        SELECT forecast_time FROM radar_grid_cache 
        ORDER BY ABS(EXTRACT(EPOCH FROM (forecast_time - NOW()))) ASC 
        LIMIT 1
    )`;
  }

  const result = await pool.query(query, params);

  // Si no hay datos (la BD está vacía), y targetTime es true, devolver array vacío.
  return { status: 'ready', data: result.rows };
};

module.exports = {
  runScraper,
  getRadarData,
  extractGribData,
  generateGridKeys,
  GLOBAL_BBOX,
  DATA_HIST_RAW_DIR,
  DATA_HIST_PROCESSED_DIR,
  processGribForUrl
};
