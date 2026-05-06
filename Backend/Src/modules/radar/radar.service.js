const pool = require('../../config/db');

// Estado global para informar al frontend si estamos cargando
let isScraping = false;
let scrapeProgress = 0; // 0 a 100

// Bounding box para Sudamérica aproximado
const SOUTH_AMERICA_BBOX = {
  north: 13.0,
  south: -56.0,
  west: -82.0,
  east: -34.0
};

// Generar la cuadrícula (nodos virtuales)
const generateGrid = () => {
  const step = 1.2; // ~132km de resolución para optimizar rendimiento de CPU
  const grid = [];
  let lat = Math.floor(SOUTH_AMERICA_BBOX.south / step) * step;
  
  while (lat <= SOUTH_AMERICA_BBOX.north) {
    let lng = Math.floor(SOUTH_AMERICA_BBOX.west / step) * step;
    while (lng <= SOUTH_AMERICA_BBOX.east) {
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
  
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
    wind_direction: results[i]?.current?.wind_direction_10m || 0
  }));
};

const runScraper = async () => {
  if (isScraping) return;
  isScraping = true;
  scrapeProgress = 0;
  
  try {
    console.log('[Radar Scraper] Verificando necesidad de recolección de clima para Sudamérica...');
    
    // 1. Asegurar que la tabla existe sin borrarla
    await pool.query(`
      CREATE TABLE IF NOT EXISTS radar_grid_cache (
        latitud DECIMAL(10,4) NOT NULL,
        longitud DECIMAL(10,4) NOT NULL,
        weather_code INT,
        temperatura DECIMAL(5,2),
        wind_speed DECIMAL(5,2),
        wind_direction INT,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (latitud, longitud)
      )
    `);

    // Intentamos agregar columnas por si venimos de la versión vieja (ignoramos error si ya existen)
    try {
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_speed DECIMAL(5,2)');
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_direction INT');
    } catch (e) {
      // Ignorar, ya existen
    }

    // Comprobar caché para recolectar solo cada madrugada a las 3 AM
    const result = await pool.query('SELECT MAX(actualizado_en) as last_update FROM radar_grid_cache');
    const lastUpdate = result.rows[0]?.last_update;
    let needsUpdate = true;

    if (lastUpdate) {
      const lastUpdateDate = new Date(lastUpdate);
      const now = new Date();
      
      // Fecha actual configurada a las 3:00 AM
      const today3AM = new Date();
      today3AM.setHours(3, 0, 0, 0);
      
      if (now < today3AM) {
        // Si aún no son las 3 AM de hoy, validamos si se recolectó ayer después de las 3 AM
        const yesterday3AM = new Date(today3AM);
        yesterday3AM.setDate(yesterday3AM.getDate() - 1);
        if (lastUpdateDate >= yesterday3AM) needsUpdate = false;
      } else {
        // Si ya pasaron las 3 AM de hoy, validamos si se recolectó hoy después de las 3 AM
        if (lastUpdateDate >= today3AM) needsUpdate = false;
      }
      
      if (!needsUpdate) {
        console.log(`[Radar Scraper] Datos de radar vigentes (última vez: ${lastUpdateDate.toLocaleString()}). Próxima recolección será a las 03:00 AM. Omitiendo scraping...`);
        isScraping = false;
        scrapeProgress = 100;
        return;
      }
    }

    console.log('[Radar Scraper] Iniciando descarga masiva...');
    await pool.query('TRUNCATE TABLE radar_grid_cache');
    
    const grid = generateGrid();
    console.log(`[Radar Scraper] Cuadrícula generada con ${grid.length} nodos virtuales.`);
    
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
              `INSERT INTO radar_grid_cache (latitud, longitud, weather_code, temperatura, wind_speed, wind_direction)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (latitud, longitud) DO UPDATE SET 
                 weather_code = EXCLUDED.weather_code,
                 temperatura = EXCLUDED.temperatura,
                 wind_speed = EXCLUDED.wind_speed,
                 wind_direction = EXCLUDED.wind_direction,
                 actualizado_en = NOW()`,
              [data.latitud, data.longitud, data.weather_code, data.temperatura, data.wind_speed, data.wind_direction]
            );
          }
        }
      } catch (err) {
        console.error(`[Radar Scraper] Error en lote ${i+1}/${totalBatches}:`, err.message);
      }
      
      scrapeProgress = Math.round(((i + 1) / totalBatches) * 100);
      // Retraso de 5.5 segundos para evitar límite HTTP 429 (Ligeramente más lento)
      await new Promise(res => setTimeout(res, 5500));
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
  const result = await pool.query('SELECT latitud, longitud, weather_code, temperatura, wind_speed, wind_direction FROM radar_grid_cache');
  return { status: 'ready', data: result.rows };
};

module.exports = {
  runScraper,
  getRadarData
};
