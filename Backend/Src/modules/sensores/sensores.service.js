/**
 * Servicio de Sensores IoT — Datos Reales
 *
 * Fuentes de datos:
 *  - temperatura, humedad, weather_code: Open-Meteo Forecast API (batch)
 *  - AQI (Calidad del Aire):             Open-Meteo Air Quality API (batch)
 *  - ICA (Calidad del Agua):             Estimación realista basada en humedad + AQI
 *  - Ruido:                              Estimación realista basada en hora del día
 *
 * Rate limit Open-Meteo: 600 req/min (plan gratuito).
 * Con ~55 sensores hacemos 2 requests batch → muy por debajo del límite.
 * Se actualiza cada 15 minutos (mínimo granularidad de Open-Meteo).
 */

const pool = require('../../config/db');
const LOCALIDADES = require('../simulacion/localidades.data');

// ─── Helpers matemáticos ──────────────────────────────────────────────────────

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Estima la Calidad del Agua (ICA 0-100) a partir de:
 *  - humedad relativa (alta humedad → más arrastre de contaminantes)
 *  - AQI (contaminación del aire correlaciona con agua)
 *  - precipitación implícita en weather_code
 */
function estimateICA(humedad, aqi, weatherCode, ranges) {
  const [iMin, iMax] = ranges.ica;

  // Base: humedad alta → agua más disponible pero potencialmente contaminada
  const humNorm = clamp(humedad / 100, 0, 1);

  // AQI alto → peor calidad de agua (correlación negativa media)
  const aqiNorm = clamp(aqi / 200, 0, 1);

  // Lluvia reciente (codes 51-82) mejora la recarga pero puede arrastrar sedimentos
  const isRaining = weatherCode >= 51 && weatherCode <= 82;

  let icaEstimado = iMax - aqiNorm * (iMax - iMin) * 0.5
                      + humNorm * (iMax - iMin) * 0.1
                      - (isRaining ? 5 : 0);

  // Añadir pequeña variación aleatoria (±3 puntos) para que no sea perfectamente lineal
  icaEstimado += (Math.random() - 0.5) * 6;

  return Number(clamp(icaEstimado, iMin, iMax).toFixed(1));
}

/**
 * Estima el nivel de Ruido (dB) basado en la hora del día.
 * Pico en hora punta (7-9h y 17-20h), silencio nocturno (0-6h).
 */
function estimateRuido(ranges) {
  const [rMin, rMax] = ranges.ruido;
  const hour = new Date().getHours();

  let factor;
  if (hour >= 0 && hour < 6)  factor = 0.15;   // madrugada
  else if (hour >= 6 && hour < 7)  factor = 0.35; // amanecer
  else if (hour >= 7 && hour <= 9)  factor = 0.85; // hora punta mañana
  else if (hour >= 10 && hour < 17) factor = 0.60; // día laboral
  else if (hour >= 17 && hour <= 20) factor = 0.90; // hora punta tarde
  else if (hour >= 21 && hour < 23)  factor = 0.45; // noche
  else factor = 0.20; // medianoche

  const ruido = rMin + factor * (rMax - rMin) + (Math.random() - 0.5) * 4;
  return Number(clamp(ruido, rMin, rMax).toFixed(1));
}

// ─── Fetch a Open-Meteo (batch) ───────────────────────────────────────────────

async function fetchWeatherBatch(localidades) {
  const lats = localidades.map(l => l.latitude).join(',');
  const lngs = localidades.map(l => l.longitude).join(',');

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo weather HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

async function fetchAqiBatch(localidades) {
  const lats = localidades.map(l => l.latitude).join(',');
  const lngs = localidades.map(l => l.longitude).join(',');

  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=european_aqi&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo AQI HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

// ─── Lógica principal de actualización ───────────────────────────────────────

let isFetching = false;

/**
 * Descarga datos reales para todos los sensores y los persiste en la BD.
 * Llama a esta función cada 15 minutos.
 */
async function actualizarSensores() {
  if (isFetching) return;
  isFetching = true;

  try {
    console.log('[Sensores IoT] Iniciando actualización de datos reales...');

    // Asegurar tabla de caché de sensores (lectura actual)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensores_cache (
        sensor_id   TEXT PRIMARY KEY,
        nombre      TEXT NOT NULL,
        latitud     DECIMAL(10,6) NOT NULL,
        longitud    DECIMAL(10,6) NOT NULL,
        temperatura DECIMAL(5,2),
        humedad     DECIMAL(5,2),
        aqi         DECIMAL(6,2),
        ica         DECIMAL(5,2),
        ruido       DECIMAL(5,2),
        weather_code INT,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Fetch en paralelo (2 peticiones batch)
    const [weatherResults, aqiResults] = await Promise.all([
      fetchWeatherBatch(LOCALIDADES),
      fetchAqiBatch(LOCALIDADES)
    ]);

    console.log(`[Sensores IoT] Datos recibidos para ${weatherResults.length} sensores.`);

    // Cargar mapping de BD para persistir en lecturas
    let dbMapping = { localidades: {}, metricas: {} };
    const locRes = await pool.query('SELECT id, nombre FROM localidades');
    locRes.rows.forEach(r => { dbMapping.localidades[r.nombre.toLowerCase()] = r.id; });
    const metRes = await pool.query('SELECT id, clave FROM metricas');
    metRes.rows.forEach(r => { dbMapping.metricas[r.clave] = r.id; });

    const localidadIds = [], metricaIds = [], valores = [];

    for (let i = 0; i < LOCALIDADES.length; i++) {
      const loc = LOCALIDADES[i];
      const w = weatherResults[i]?.current || {};
      const a = aqiResults[i]?.current || {};

      const temperatura = w.temperature_2m ?? null;
      const humedad     = w.relative_humidity_2m ?? null;
      const weatherCode = w.weather_code ?? null;
      const aqi         = a.european_aqi ?? null;

      // Estimar métricas sin API real
      const ica   = (humedad !== null && aqi !== null)
                    ? estimateICA(humedad, aqi, weatherCode || 0, loc.ranges)
                    : null;
      const ruido = estimateRuido(loc.ranges);

      // Upsert en tabla de caché para GET instantáneo desde el frontend
      await pool.query(`
        INSERT INTO sensores_cache
          (sensor_id, nombre, latitud, longitud, temperatura, humedad, aqi, ica, ruido, weather_code, actualizado_en)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (sensor_id) DO UPDATE SET
          temperatura    = EXCLUDED.temperatura,
          humedad        = EXCLUDED.humedad,
          aqi            = EXCLUDED.aqi,
          ica            = EXCLUDED.ica,
          ruido          = EXCLUDED.ruido,
          weather_code   = EXCLUDED.weather_code,
          actualizado_en = NOW()
      `, [loc.id, loc.name, loc.latitude, loc.longitude,
          temperatura, humedad, aqi, ica, ruido, weatherCode]);

      // Persistir en lecturas (fuente_id = 3 → sensor IoT real)
      const locId = dbMapping.localidades[loc.name.toLowerCase()];
      if (locId) {
        const metricsToSave = { temperatura, humedad, aqi, ica, ruido };
        Object.entries(metricsToSave).forEach(([clave, val]) => {
          const metId = dbMapping.metricas[clave];
          if (metId && val !== null) {
            localidadIds.push(locId);
            metricaIds.push(metId);
            valores.push(val);
          }
        });
      }
    }

    // Inserción masiva en lecturas
    if (localidadIds.length > 0) {
      await pool.query(`
        INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
        SELECT NOW(), unnest($1::int[]), unnest($2::int[]), unnest($3::numeric[]), 3
        ON CONFLICT DO NOTHING
      `, [localidadIds, metricaIds, valores]);
    }

    console.log(`[Sensores IoT] ✅ ${LOCALIDADES.length} sensores actualizados. ${localidadIds.length} lecturas guardadas.`);
  } catch (err) {
    console.error('[Sensores IoT] ❌ Error en actualización:', err.message);
  } finally {
    isFetching = false;
  }
}

/**
 * Devuelve todos los sensores con sus últimas lecturas desde la caché.
 */
async function getSensoresCache() {
  try {
    const { rows } = await pool.query(`
      SELECT sensor_id as id, nombre as name, latitud as latitude, longitud as longitude,
             temperatura, humedad, aqi, ica, ruido, weather_code, actualizado_en
      FROM sensores_cache
      ORDER BY nombre
    `);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      weather_code: r.weather_code,
      actualizado_en: r.actualizado_en,
      data: {
        temperatura: r.temperatura !== null ? Number(r.temperatura) : null,
        humedad:     r.humedad     !== null ? Number(r.humedad)     : null,
        aqi:         r.aqi         !== null ? Number(r.aqi)         : null,
        ica:         r.ica         !== null ? Number(r.ica)         : null,
        ruido:       r.ruido       !== null ? Number(r.ruido)       : null,
      }
    }));
  } catch (err) {
    console.error('[Sensores IoT] Error leyendo caché:', err.message);
    return [];
  }
}

/**
 * Estima datos para una coordenada arbitraria (clic en el mapa fuera de sensores).
 * Usa Open-Meteo para clima real + estima ICA y Ruido.
 */
async function estimarDatosPuntoArbitrario(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi&timezone=auto`;

  const [wRes, aRes] = await Promise.all([fetch(url), fetch(aqiUrl)]);
  const wData = await wRes.json();
  const aData = await aRes.json();

  const temperatura = wData.current?.temperature_2m ?? null;
  const humedad     = wData.current?.relative_humidity_2m ?? null;
  const weatherCode = wData.current?.weather_code ?? null;
  const aqi         = aData.current?.european_aqi ?? null;

  // Rangos genéricos para estimación en zonas sin sensor definido
  const genericRanges = {
    ica:   [30, 90],
    ruido: [35, 85]
  };

  const ica   = (humedad !== null && aqi !== null)
                ? estimateICA(humedad, aqi, weatherCode || 0, genericRanges)
                : null;
  const ruido = estimateRuido(genericRanges);

  return { temperatura, humedad, aqi, ica, ruido, weatherCode };
}

/**
 * Inicia el cron job de actualización cada 15 minutos.
 */
function startSensorCron() {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
  actualizarSensores(); // Primera carga inmediata al arrancar
  setInterval(actualizarSensores, INTERVAL_MS);
  console.log('[Sensores IoT] 🔌 Cron iniciado — actualización cada 15 minutos.');
}

module.exports = { startSensorCron, getSensoresCache, estimarDatosPuntoArbitrario };
