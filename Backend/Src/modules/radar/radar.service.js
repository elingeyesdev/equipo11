const pool = require('../../config/db');

// Estado global para informar al frontend si estamos cargando
let isScraping = false;
let scrapeProgress = 0; // 0 a 100

// Bounding box para todo el Continente Americano
const AMERICAS_BBOX = {
  north: 72.0,   // Norte de Canadá/Alaska
  south: -56.0,  // Tierra del Fuego
  west: -168.0,  // Extremo oeste de Alaska
  east: -34.0    // Extremo este de Brasil
};

// Generar la cuadrícula (nodos virtuales)
const generateGrid = () => {
  const step = 1.5; // Resolución optimizada (~166km) para cubrir toda América sin agotar cuota API
  const grid = [];
  let lat = Math.floor(AMERICAS_BBOX.south / step) * step;
  
  while (lat <= AMERICAS_BBOX.north) {
    let lng = Math.floor(AMERICAS_BBOX.west / step) * step;
    while (lng <= AMERICAS_BBOX.east) {
      grid.push({ latitude: lat + (step/2), longitude: lng + (step/2) });
      lng += step;
    }
    lat += step;
  }
  return grid;
};

// Obtener datos por lotes usando fetch nativo con reintentos
const fetchBatchFromOpenMeteo = async (batch, retries = 2) => {
  const lats = batch.map(p => p.latitude).join(',');
  const lngs = batch.map(p => p.longitude).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure&timezone=auto`;
  
  let response;
  try {
    response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Open-Meteo HTTP ${response.status}: ${errText}`);
    }
  } catch (error) {
    if (retries > 0) {
      console.warn(`[Radar Scraper] Error en lote, reintentando en 10s... (${retries} intentos restantes). Error: ${error.message}`);
      await new Promise(res => setTimeout(res, 10000));
      return fetchBatchFromOpenMeteo(batch, retries - 1);
    } else {
      throw error;
    }
  }
  
  const data = await response.json();
  const results = Array.isArray(data) ? data : [data];
  
  return batch.map((p, i) => ({
    latitud: p.latitude,
    longitud: p.longitude,
    temperatura: results[i]?.current?.temperature_2m || null,
    weather_code: results[i]?.current?.weather_code || null,
    wind_speed: results[i]?.current?.wind_speed_10m || 0,
    wind_direction: results[i]?.current?.wind_direction_10m || 0,
    rafagas: results[i]?.current?.wind_gusts_10m || 0,
    presion: results[i]?.current?.surface_pressure || 1013 // 1013 es la presión a nivel del mar promedio
  }));
};

const runScraper = async () => {
  if (isScraping) return;
  isScraping = true;
  scrapeProgress = 0;
  
  try {
    console.log('[Radar Scraper] Verificando necesidad de recolección de clima para AMÉRICA...');
    
    // 1. Asegurar que la tabla existe sin borrarla
    await pool.query(`
      CREATE TABLE IF NOT EXISTS radar_grid_cache (
        latitud DECIMAL(10,4) NOT NULL,
        longitud DECIMAL(10,4) NOT NULL,
        weather_code INT,
        temperatura DECIMAL(5,2),
        wind_speed DECIMAL(5,2),
        wind_direction INT,
        rafagas DECIMAL(5,2),
        presion DECIMAL(6,2),
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (latitud, longitud)
      )
    `);

    try {
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_speed DECIMAL(5,2)');
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_direction INT');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN rafagas DECIMAL(5,2)');
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN presion DECIMAL(6,2)');
    } catch (e) {}

    // Comprobar si ya existen datos en la tabla
    const result = await pool.query('SELECT MAX(actualizado_en) as last_update FROM radar_grid_cache');
    const lastUpdate = result.rows[0]?.last_update;

    if (lastUpdate) {
      console.log(`[Radar Scraper] Datos de radar existentes encontrados. Omitiendo recolección para ahorrar cuota API.`);
      isScraping = false;
      scrapeProgress = 100;
      return;
    }

    console.log('[Radar Scraper] Iniciando descarga masiva...');
    await pool.query('TRUNCATE TABLE radar_grid_cache');
    
    const grid = generateGrid();
    
    // Mezclar el array aleatoriamente (Fisher-Yates) para que si el scraper se detiene por límite de API,
    // tengamos una muestra uniforme de TODO el continente en lugar de solo la parte más al sur.
    for (let i = grid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [grid[i], grid[j]] = [grid[j], grid[i]];
    }
    
    console.log(`[Radar Scraper] Cuadrícula generada y mezclada con ${grid.length} nodos virtuales.`);
    
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(grid.length / BATCH_SIZE);
    
    for (let i = 0; i < totalBatches; i++) {
      const batch = grid.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      
      try {
        console.log(`[Radar Scraper] Descargando lote ${i+1}/${totalBatches}...`);
        const batchResults = await fetchBatchFromOpenMeteo(batch);
        
        for (const data of batchResults) {
          if (data.weather_code !== null) {
            await pool.query(
              `INSERT INTO radar_grid_cache (latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (latitud, longitud) DO UPDATE SET 
                 weather_code = EXCLUDED.weather_code,
                 temperatura = EXCLUDED.temperatura,
                 wind_speed = EXCLUDED.wind_speed,
                 wind_direction = EXCLUDED.wind_direction,
                 rafagas = EXCLUDED.rafagas,
                 presion = EXCLUDED.presion,
                 actualizado_en = NOW()`,
              [data.latitud, data.longitud, data.weather_code, data.temperatura, data.wind_speed, data.wind_direction, data.rafagas, data.presion]
            );
          }
        }
      } catch (err) {
        console.error(`[Radar Scraper] Error en lote ${i+1}/${totalBatches}:`, err.message);
        // Si alcanzamos el límite de cuota (429), detenemos la recolección pero conservamos lo ya descargado
        if (err.message.includes('429')) {
          console.warn('[Radar Scraper] Cuota de API excedida (Horaria/Diaria). Deteniendo recolección y mostrando datos parciales.');
          break; 
        }
      }
      
      scrapeProgress = Math.round(((i + 1) / totalBatches) * 100);
      // Retraso masivo de 15 segundos para evitar bloqueos por rate limit de Open-Meteo
      await new Promise(res => setTimeout(res, 15000));
    }
    
    console.log('[Radar Scraper] Recolección completada con éxito. Datos almacenados en BD.');
  } catch (error) {
    console.error('[Radar Scraper] Error fatal:', error);
  } finally {
    isScraping = false;
    scrapeProgress = 100;
  }
};

const getRadarData = async () => {
  if (isScraping) {
    return { status: 'loading', progress: scrapeProgress };
  }
  
  // Leemos todo el radar local instantáneamente
  const result = await pool.query('SELECT latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion FROM radar_grid_cache');
  return { status: 'ready', data: result.rows };
};

module.exports = {
  runScraper,
  getRadarData
};
