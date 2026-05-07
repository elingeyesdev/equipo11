const pool = require('../../config/db');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

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

const getLatestNOAAUrl = async () => {
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
            // Filtro NOAA NOMADS. Sin límites geográficos para obtener TODO EL PLANETA.
            // Añadimos CRAIN (Rain), CSNOW (Snow) y VIS (Visibility para la niebla).
            const url = `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?file=gfs.t${hour}z.pgrb2.0p25.f000&lev_10_m_above_ground=on&lev_mean_sea_level=on&lev_surface=on&var_UGRD=on&var_VGRD=on&var_GUST=on&var_PRMSL=on&var_CRAIN=on&var_CSNOW=on&var_VIS=on&dir=%2Fgfs.${dateStr}%2F${hour}%2Fatmos`;
            
            try {
                const response = await fetch(url, { method: 'HEAD' });
                if (response.ok) {
                    return url;
                }
            } catch(e) {
               console.warn(`[Radar Scraper] Error conectando a NOMADS: ${e.message}`);
            }
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

const runScraper = async () => {
  if (isScraping) return;
  isScraping = true;
  scrapeProgress = 0;
  
  try {
    console.log('[Radar Scraper] Iniciando sistema Bulk Data GRIB2 de NOAA...');
    
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

    // Asegurarse de que las columnas nuevas existan si la tabla es antigua
    try {
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_speed DECIMAL(5,2)');
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN wind_direction INT');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN rafagas DECIMAL(5,2)');
      await pool.query('ALTER TABLE radar_grid_cache ADD COLUMN presion DECIMAL(6,2)');
    } catch (e) {}

    // Para forzar la prueba de descarga, temporalmente omitimos el caché
    /*
    const result = await pool.query('SELECT MAX(actualizado_en) as last_update FROM radar_grid_cache');
    const lastUpdate = result.rows[0]?.last_update;

    if (lastUpdate) {
      console.log(`[Radar Scraper] Datos bulk existentes. Omitiendo recolección.`);
      isScraping = false;
      scrapeProgress = 100;
      return;
    }
    */

    console.log('[Radar Scraper] Buscando último modelo GFS mundial...');
    const url = await getLatestNOAAUrl();
    console.log(`[Radar Scraper] Modelo encontrado! Descargando archivo binario recortado de NOMADS...`);
    
    scrapeProgress = 10;
    
    const gribPath = path.join(__dirname, 'temp_weather.grib2');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fallo en descarga GRIB: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(gribPath, Buffer.from(buffer));
    
    console.log(`[Radar Scraper] Archivo GRIB guardado (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB). Extrayendo variables científicas...`);
    scrapeProgress = 40;
    
    const gridKeys = generateGridKeys();
    
    const mapU = await extractGribData(gribPath, '10u', gridKeys);
    const mapV = await extractGribData(gribPath, '10v', gridKeys);
    const mapGust = await extractGribData(gribPath, 'gust', gridKeys);
    const mapPress = await extractGribData(gribPath, 'prmsl', gridKeys);
    
    // Extracción de clima
    console.log(`[Radar Scraper] Extrayendo variables de precipitación y visibilidad...`);
    const mapRain = await extractGribData(gribPath, 'crain', gridKeys);
    const mapSnow = await extractGribData(gribPath, 'csnow', gridKeys);
    const mapVis = await extractGribData(gribPath, 'vis', gridKeys);
    
    console.log(`[Radar Scraper] Procesando vectores mundiales a meteorológicos...`);
    scrapeProgress = 70;
    
    await pool.query('TRUNCATE TABLE radar_grid_cache');
    
    let count = 0;
    for (const key of gridKeys) {
        if (mapU.has(key) && mapV.has(key)) {
            const u = mapU.get(key);
            const v = mapV.get(key);
            const gustMs = mapGust.get(key) || 0;
            const pressPa = mapPress.get(key) || 101325;
            
            // Determinar tipo de clima (WMO code)
            let wCode = null;
            if (mapSnow.get(key) === 1) wCode = 71; // Nieve
            else if (mapRain.get(key) === 1) wCode = 61; // Lluvia
            else if (mapVis.has(key) && mapVis.get(key) < 2000) wCode = 45; // Niebla (Visibilidad menor a 2km)
            
            const speedKmH = Math.sqrt(u*u + v*v) * 3.6;
            
            // Corrección Matemática Bruta: Convertir Vector Cartesiano a Grados de Brújula Meteorológica
            let dirDeg = 270 - (Math.atan2(v, u) * (180 / Math.PI));
            dirDeg = Math.round((dirDeg + 360) % 360);
            
            const gustKmH = gustMs * 3.6;
            const pressHpa = pressPa / 100; 
            
            let [latStr, lonStr] = key.split('_');
            let lat = parseFloat(latStr);
            let lon = parseFloat(lonStr);
            if (lon > 180) lon -= 360; // Revertir 0-360 a -180 a 180
            
            await pool.query(
              `INSERT INTO radar_grid_cache (latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (latitud, longitud) DO NOTHING`,
              [lat, lon, wCode, null, speedKmH, dirDeg, gustKmH, pressHpa]
            );
            count++;
        }
    }
    
    console.log(`[Radar Scraper] Éxito absoluto. ${count} nodos de la NOAA insertados en la BD en un solo barrido.`);
    
    // Limpieza
    try { fs.unlinkSync(gribPath); } catch (e) {}
    
  } catch (error) {
    console.error('[Radar Scraper] Error fatal Bulk Data:', error);
  } finally {
    isScraping = false;
    scrapeProgress = 100;
  }
};

const getRadarData = async () => {
  if (isScraping) {
    return { status: 'loading', progress: scrapeProgress };
  }
  
  const result = await pool.query('SELECT latitud, longitud, weather_code, temperatura, wind_speed, wind_direction, rafagas, presion FROM radar_grid_cache');
  return { status: 'ready', data: result.rows };
};

module.exports = {
  runScraper,
  getRadarData
};
