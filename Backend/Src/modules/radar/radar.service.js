const pool = require('../../config/db');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

// Configuración de directorios de datos (Persistentes)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_RAW_DIR = path.join(DATA_DIR, 'raw');
const DATA_PROCESSED_DIR = path.join(DATA_DIR, 'Processed');

// Asegurar que existan los directorios
const initDirectories = () => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_RAW_DIR)) fs.mkdirSync(DATA_RAW_DIR, { recursive: true });
    if (!fs.existsSync(DATA_PROCESSED_DIR)) fs.mkdirSync(DATA_PROCESSED_DIR, { recursive: true });
    console.log(`[Radar Scraper] Directorios de datos inicializados en: ${DATA_DIR}`);
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
      const gridLat = (lat + (step/2)).toFixed(2);
      let gridLng = (lng + (step/2));
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

    const url = `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t${hour}z.pgrb2.0p25.f000&lev_10_m_above_ground=on&lev_mean_sea_level=on&lev_surface=on&var_UGRD=on&var_VGRD=on&var_GUST=on&var_PRMSL=on&var_CRAIN=on&var_CSNOW=on&var_VIS=on&dir=%2Fgfs.${dateStr}%2F${hour}%2Fatmos`;
    
    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
            return { url, dateStr, hour };
        }
    } catch(e) {
       console.warn(`[Radar Scraper] Error conectando a NOMADS para ${dateStr} ${hour}z: ${e.message}`);
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
    try {
        // Ejecutar herramienta C con maxBuffer ampliado a 50MB (el output de texto puede ser grande)
        const { stdout } = await execPromise(`grib_get_data -F "%.2f" -w shortName=${shortName} ${gribPath}`, { maxBuffer: 50 * 1024 * 1024 });
        const lines = stdout.split('\n');
        const data = new Map();
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length < 3) continue;
            
            const lat = parts[0];
            const lon = parts[1];
            const val = parts[2];
            
            const key = `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;
            
            if (gridKeys.has(key)) {
                data.set(key, parseFloat(val));
            }
        }
        return data;
    } catch (err) {
        console.warn(`[Radar Scraper] Warning: No se pudo extraer ${shortName} o no está en el GRIB. ${err.message}`);
        return new Map();
    }
};

// Table creation moved down

const processGribForUrl = async (url, dateStr, hour, forecastTimeStr, isBackground = false) => {
    const jsonFileName = `gfs_${dateStr}_${hour}.json`;
    const jsonPath = path.join(DATA_PROCESSED_DIR, jsonFileName);
    const gribFileName = `gfs_${dateStr}_${hour}.grib2`;
    const gribPath = path.join(DATA_RAW_DIR, gribFileName);

    try {
        let gridData = [];

        // 1. Intentar cargar desde Caché Procesada (JSON)
        if (fs.existsSync(jsonPath)) {
            console.log(`[Radar Scraper] Encontrada caché procesada (JSON): ${jsonFileName}. Cargando...`);
            const rawJson = fs.readFileSync(jsonPath, 'utf8');
            gridData = JSON.parse(rawJson);
        } else {
            // 2. Si no hay JSON, procesar GRIB
            if (fs.existsSync(gribPath)) {
                console.log(`[Radar Scraper] El archivo GRIB ${gribFileName} ya existe localmente.`);
            } else {
                console.log(`[Radar Scraper] Descargando GRIB desde NOAA para ${forecastTimeStr}...`);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Fallo en descarga GRIB: ${response.statusText}`);
                const buffer = await response.arrayBuffer();
                fs.writeFileSync(gribPath, Buffer.from(buffer));
                console.log(`[Radar Scraper] GRIB guardado en ${gribPath}.`);
            }

            console.log(`[Radar Scraper] Extrayendo datos del GRIB...`);
            if (!isBackground) scrapeProgress = 40;
            const gridKeys = generateGridKeys();
            
            const [mapU, mapV, mapGust, mapPress, mapRain, mapSnow, mapVis] = await Promise.all([
                extractGribData(gribPath, '10u', gridKeys),
                extractGribData(gribPath, '10v', gridKeys),
                extractGribData(gribPath, 'gust', gridKeys),
                extractGribData(gribPath, 'prmsl', gridKeys),
                extractGribData(gribPath, 'crain', gridKeys),
                extractGribData(gribPath, 'csnow', gridKeys),
                extractGribData(gribPath, 'vis', gridKeys)
            ]);

            console.log(`[Radar Scraper] Calculando vectores para ${forecastTimeStr}...`);
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
                    
                    const speedKmH = Math.sqrt(u*u + v*v) * 3.6;
                    let dirDeg = 270 - (Math.atan2(v, u) * (180 / Math.PI));
                    dirDeg = Math.round((dirDeg + 360) % 360);
                    
                    let [latStr, lonStr] = key.split('_');
                    let lat = parseFloat(latStr);
                    let lon = parseFloat(lonStr);
                    if (lon > 180) lon -= 360; 

                    gridData.push({
                        lat, lon, 
                        wCode, 
                        speed: Number(speedKmH.toFixed(2)), 
                        dir: dirDeg, 
                        gust: Number((gustMs * 3.6).toFixed(2)), 
                        press: Number((pressPa / 100).toFixed(2))
                    });
                }
            }

            // Guardar JSON para la próxima vez
            fs.writeFileSync(jsonPath, JSON.stringify(gridData));
            console.log(`[Radar Scraper] Caché JSON creada: ${jsonFileName}`);
        }

        // 3. Insertar en Base de Datos (Bulk Insert para velocidad)
        console.log(`[Radar Scraper] Insertando ${gridData.length} nodos en la base de datos...`);
        await pool.query('DELETE FROM radar_grid_cache WHERE forecast_time = $1', [forecastTimeStr]);
        
        // Dividir en chunks para no saturar la conexión
        const chunkSize = 5000;
        for (let i = 0; i < gridData.length; i += chunkSize) {
            const chunk = gridData.slice(i, i + chunkSize);
            const values = [];
            const placeholders = chunk.map((p, idx) => {
                const offset = idx * 9;
                values.push(p.lat, p.lon, p.wCode, null, p.speed, p.dir, p.gust, p.press, forecastTimeStr);
                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
            }).join(',');

            await pool.query(
                `INSERT INTO radar_grid_cache (latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion, forecast_time)
                 VALUES ${placeholders}
                 ON CONFLICT (latitud, longitud, forecast_time) DO NOTHING`,
                values
            );
        }
        
        console.log(`[Radar Scraper] ✅ Completado ${forecastTimeStr}.`);
    } catch (err) {
        console.error(`[Radar Scraper] ❌ Error procesando ${forecastTimeStr}:`, err);
    }
};

let isScrapingHistory = false;

const scrapeHistoricalBackground = async () => {
    if (isScrapingHistory) return;
    isScrapingHistory = true;
    console.log('[Radar Scraper] Iniciando descarga en segundo plano del histórico (últimos 3 días)...');
    
    const hours = ['00', '06', '12', '18'];
    const now = new Date();
    
    try {
        // Recorrer los últimos 3 días
        for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
            const d = new Date(now);
            d.setUTCDate(d.getUTCDate() - dayOffset);
            for (const hour of hours) {
                const result = await getNOAAUrlForDate(d, hour);
                if (result) {
                    const { url, dateStr, hour: h } = result;
                    const forecastTimeStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${h}:00:00Z`;
                    
                    // Verificar si ya tenemos esta fecha en caché para no volver a descargar
                    const check = await pool.query('SELECT 1 FROM radar_grid_cache WHERE forecast_time = $1 LIMIT 1', [forecastTimeStr]);
                    if (check.rowCount === 0) {
                        await processGribForUrl(url, dateStr, h, forecastTimeStr, true);
                    }
                }
            }
        }
        console.log('[Radar Scraper] Histórico descargado exitosamente.');
    } catch (err) {
        console.error('[Radar Scraper] Error en histórico de fondo:', err);
    } finally {
        isScrapingHistory = false;
    }
};

const runScraper = async () => {
  if (isScraping) return;
  isScraping = true;
  scrapeProgress = 0;
  
  try {
    console.log('[Radar Scraper] Iniciando sistema Bulk Data GRIB2 de NOAA...');
    
    // Migraciones para tablas existentes (initDb se encarga de la creación inicial)

    // Asegurarse de que las columnas nuevas existan si la tabla es antigua
    try {
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_speed DECIMAL(5,2)');
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_direction INT');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN rafagas DECIMAL(5,2)');
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN presion DECIMAL(6,2)');
    } catch (e) {}
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
           console.log(`[Radar Scraper] Actualizando Primary Key de radar_grid_cache (de ${pkColsRes.rows[0].count} a 3 columnas)...`);
           await pool.query(`ALTER TABLE radar_grid_cache DROP CONSTRAINT ${constraintName}`);
           await pool.query('ALTER TABLE radar_grid_cache ADD PRIMARY KEY (latitud, longitud, forecast_time)');
        }
      }
    } catch (e) {
      console.warn('[Radar Scraper] Warning en migración de PK:', e.message);
    }

    console.log('[Radar Scraper] Buscando último modelo GFS mundial...');
    initDirectories(); // Asegurar carpetas antes de procesar
    const result = await getLatestNOAAUrl();
    const { url, dateStr, hour } = result;
    const forecastTimeStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${hour}:00:00Z`;
    
    scrapeProgress = 10;
    await processGribForUrl(url, dateStr, hour, forecastTimeStr, false);
    
  } catch (error) {
    console.error('[Radar Scraper] Error fatal Bulk Data:', error);
  } finally {
    isScraping = false;
    scrapeProgress = 100;
    
    // Disparar en background la obtención del histórico
    setTimeout(scrapeHistoricalBackground, 2000);
  }
};

const getRadarData = async (targetTime = null) => {
  if (isScraping && !targetTime) {
    return { status: 'loading', progress: scrapeProgress };
  }
  
  let query = 'SELECT latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion, forecast_time FROM radar_grid_cache';
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
    // Si no hay targetTime, devolver el más reciente
    query += ' WHERE forecast_time = (SELECT MAX(forecast_time) FROM radar_grid_cache)';
  }

  const result = await pool.query(query, params);
  
  // Si no hay datos (la BD está vacía), y targetTime es true, devolver array vacío.
  return { status: 'ready', data: result.rows };
};

module.exports = {
  runScraper,
  getRadarData
};
