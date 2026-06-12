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
const logger = require('../../utils/logger');
const { getDbMapping } = require('../../utils/dbMapping');

// ─── Helpers matemáticos ──────────────────────────────────────────────────────

const { clamp } = require('../../utils/math');
const { estimateICA, estimateRuido } = require('../../utils/estimadores');

// ─── Fetch a Open-Meteo (batch) ───────────────────────────────────────────────

async function fetchWeatherBatch(localidades) {
  const lats = localidades.map(l => l.latitude).join(',');
  const lngs = localidades.map(l => l.longitude).join(',');

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;

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
    logger.info('[Sensores IoT] Iniciando actualización de datos reales...');

    // Fetch en paralelo (2 peticiones batch)
    const [weatherResults, aqiResults] = await Promise.all([
      fetchWeatherBatch(LOCALIDADES),
      fetchAqiBatch(LOCALIDADES)
    ]);

    logger.info(`[Sensores IoT] Datos recibidos para ${weatherResults.length} sensores.`);

    // Cargar mapping de BD para persistir en lecturas
    const dbMapping = await getDbMapping();

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
          (sensor_id, nombre, latitud, longitud, temperatura, humedad, aqi, ica, ruido, weather_code, wind_speed, wind_direction, actualizado_en)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (sensor_id) DO UPDATE SET
          temperatura    = EXCLUDED.temperatura,
          humedad        = EXCLUDED.humedad,
          aqi            = EXCLUDED.aqi,
          ica            = EXCLUDED.ica,
          ruido          = EXCLUDED.ruido,
          weather_code   = EXCLUDED.weather_code,
          wind_speed     = EXCLUDED.wind_speed,
          wind_direction = EXCLUDED.wind_direction,
          actualizado_en = NOW()
      `, [loc.id, loc.name, loc.latitude, loc.longitude,
          temperatura, humedad, aqi, ica, ruido, weatherCode, w.wind_speed_10m, w.wind_direction_10m]);

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

    logger.info(`[Sensores IoT] ✅ ${LOCALIDADES.length} sensores actualizados. ${localidadIds.length} lecturas guardadas.`);
  } catch (err) {
    logger.error('[Sensores IoT] ❌ Error en actualización:', err.message);
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
             temperatura, humedad, aqi, ica, ruido, weather_code,
             wind_speed, wind_direction, actualizado_en
      FROM sensores_cache
      ORDER BY nombre
    `);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      weather_code: r.weather_code,
      wind_speed: r.wind_speed !== null ? Number(r.wind_speed) : null,
      wind_direction: r.wind_direction !== null ? Number(r.wind_direction) : null,
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
    logger.error('[Sensores IoT] Error leyendo caché:', err.message);
    return [];
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estima datos para una coordenada arbitraria (clic en el mapa fuera de sensores).
 * Usa Open-Meteo para clima real + estima ICA y Ruido.
 * Si las llamadas externas fallan, calcula la localidad más cercana y genera
 * lecturas simuladas realistas basadas en sus rangos.
 */
async function estimarDatosPuntoArbitrario(lat, lng) {
  let temperatura = null;
  let humedad     = null;
  let weatherCode = null;
  let aqi         = null;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi&timezone=auto`;

    const [wRes, aRes] = await Promise.all([fetch(url), fetch(aqiUrl)]);
    if (wRes.ok && aRes.ok) {
      const wData = await wRes.json();
      const aData = await aRes.json();

      temperatura = wData.current?.temperature_2m ?? null;
      humedad     = wData.current?.relative_humidity_2m ?? null;
      weatherCode = wData.current?.weather_code ?? null;
      aqi         = aData.current?.european_aqi ?? null;
    } else {
      logger.warn(`[Sensores Service] Open-Meteo returned status ${wRes.status} / ${aRes.status}`);
    }
  } catch (err) {
    logger.warn(`[Sensores Service] Error fetching Open-Meteo: ${err.message}`);
  }

  // Buscar la localidad de LOCALIDADES más cercana
  let targetRanges = {
    temperatura: [15, 28],
    humedad: [40, 80],
    aqi: [30, 100],
    ica: [40, 90],
    ruido: [35, 80]
  };
  let nearestCityName = 'Desconocida';
  let minDist = Infinity;

  for (const loc of LOCALIDADES) {
    const dist = haversineKm(lat, lng, loc.latitude, loc.longitude);
    if (dist < minDist) {
      minDist = dist;
      targetRanges = loc.ranges;
      nearestCityName = loc.name;
    }
  }

  // Si los datos climáticos no se pudieron obtener, los generamos de forma realista
  if (temperatura === null) {
    const [tMin, tMax] = targetRanges.temperatura || [15, 28];
    temperatura = Number((tMin + Math.random() * (tMax - tMin)).toFixed(1));
  }
  if (humedad === null) {
    const [hMin, hMax] = targetRanges.humedad || [40, 80];
    humedad = Math.round(hMin + Math.random() * (hMax - hMin));
  }
  if (weatherCode === null) {
    if (humedad > 80) weatherCode = Math.random() > 0.5 ? 61 : 3;
    else if (humedad < 30) weatherCode = 0;
    else weatherCode = Math.random() > 0.5 ? 1 : 2;
  }
  if (aqi === null) {
    const [aMin, aMax] = targetRanges.aqi || [30, 100];
    aqi = Math.round(aMin + Math.random() * (aMax - aMin));
  }

  // Estimar ICA y Ruido con los rangos correspondientes
  const ica = estimateICA(humedad, aqi, weatherCode, targetRanges);
  const ruido = estimateRuido(targetRanges);

  return {
    temperatura,
    humedad,
    aqi,
    ica,
    ruido,
    weatherCode,
    source: `Estimación (${nearestCityName})`
  };
}


/**
 * Inicia el cron job de actualización cada 15 minutos.
 */
let cronIntervalId = null;

function startSensorCron() {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
  actualizarSensores(); // Primera carga inmediata al arrancar
  cronIntervalId = setInterval(actualizarSensores, INTERVAL_MS);
  logger.info('[Sensores IoT] 🔌 Cron iniciado — actualización cada 15 minutos.');
}

function stopSensorCron() {
  if (cronIntervalId) {
    clearInterval(cronIntervalId);
    cronIntervalId = null;
    logger.info('[Sensores IoT] Cron detenido.');
  }
}

module.exports = { startSensorCron, stopSensorCron, getSensoresCache, estimarDatosPuntoArbitrario };
