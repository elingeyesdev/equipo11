const pool = require('../../config/db');

// Estado global para informar al frontend si estamos cargando
let isScraping = false;
let scrapeProgress = 0; // 0 a 100

// Bounding box para Bolivia aproximado
const BOLIVIA_BBOX = {
  north: -9.6,
  south: -23.0,
  west: -69.6,
  east: -57.4
};

// Generar la cuadrícula (nodos virtuales)
const generateGrid = () => {
  const step = 0.6; // ~66km de resolución (aprox 450 nodos para nunca exceder el límite de 600/minuto de Open-Meteo)
  const grid = [];
  let lat = Math.floor(BOLIVIA_BBOX.south / step) * step;
  
  while (lat <= BOLIVIA_BBOX.north) {
    let lng = Math.floor(BOLIVIA_BBOX.west / step) * step;
    while (lng <= BOLIVIA_BBOX.east) {
      grid.push({ latitude: lat + (step/2), longitude: lng + (step/2) });
      lng += step;
    }
    lat += step;
  }
  return grid;
};

// Obtener datos por lotes (max 100) usando fetch nativo de Node.js
const fetchBatchFromOpenMeteo = async (batch) => {
  const lats = batch.map(p => p.latitude).join(',');
  const lngs = batch.map(p => p.longitude).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code&timezone=auto`;
  
  const response = await fetch(url);
  if (!response.ok) {
    // Leer el body para saber por qué falló
    const errText = await response.text();
    throw new Error(`Open-Meteo HTTP ${response.status}: ${errText}`);
  }
  
  const data = await response.json();
  const results = Array.isArray(data) ? data : [data];
  
  return batch.map((p, i) => ({
    latitud: p.latitude,
    longitud: p.longitude,
    temperatura: results[i]?.current?.temperature_2m || null,
    weather_code: results[i]?.current?.weather_code || null
  }));
};

const runScraper = async () => {
  if (isScraping) return;
  isScraping = true;
  scrapeProgress = 0;
  
  try {
    console.log('[Radar Scraper] Iniciando recolección de clima para Bolivia...');
    
    // 1. Asegurar que la tabla existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS radar_grid_cache (
        latitud DECIMAL(10,4) NOT NULL,
        longitud DECIMAL(10,4) NOT NULL,
        weather_code INT,
        temperatura DECIMAL(5,2),
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (latitud, longitud)
      )
    `);
    
    await pool.query('TRUNCATE TABLE radar_grid_cache');
    
    const grid = generateGrid();
    console.log(`[Radar Scraper] Cuadrícula generada con ${grid.length} nodos virtuales.`);
    
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(grid.length / BATCH_SIZE);
    
    for (let i = 0; i < totalBatches; i++) {
      const batch = grid.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      
      try {
        console.log(`[Radar Scraper] Descargando lote ${i+1}/${totalBatches}...`);
        const batchResults = await fetchBatchFromOpenMeteo(batch);
        
        for (const data of batchResults) {
          if (data.weather_code !== null) {
            await pool.query(
              `INSERT INTO radar_grid_cache (latitud, longitud, weather_code, temperatura)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (latitud, longitud) DO UPDATE SET 
                 weather_code = EXCLUDED.weather_code,
                 temperatura = EXCLUDED.temperatura,
                 actualizado_en = NOW()`,
              [data.latitud, data.longitud, data.weather_code, data.temperatura]
            );
          }
        }
      } catch (err) {
        console.error(`[Radar Scraper] Error en lote ${i+1}/${totalBatches}:`, err.message);
      }
      
      scrapeProgress = Math.round(((i + 1) / totalBatches) * 100);
      // Retraso de 3.5 segundos para evitar límite HTTP 429
      await new Promise(res => setTimeout(res, 3500));
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
  const result = await pool.query('SELECT latitud, longitud, weather_code, temperatura FROM radar_grid_cache');
  return { status: 'ready', data: result.rows };
};

module.exports = {
  runScraper,
  getRadarData
};
