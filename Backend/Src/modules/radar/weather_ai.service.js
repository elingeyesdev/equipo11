const pool = require('../../config/db');
const { getRadarData } = require('./radar.service');
const logger = require('../../utils/logger');

let biasPromise = null;

const calculateLocalBias = async () => {
    try {
        const sensorRes = await pool.query(`SELECT latitud, longitud, wind_speed, temperatura FROM sensores_cache`);
        if (sensorRes.rowCount === 0) return { speedFactor: 1 };

        let totalSpeedDiff = 0;
        let count = 0;

        for (const sensor of sensorRes.rows) {
            const bestLat = Math.round(sensor.latitud - 0.5) + 0.5;
            const bestLon = Math.round(sensor.longitud - 0.5) + 0.5;
            
            // Fetch only the nearest radar point for this sensor
            const radarRes = await pool.query(`
                SELECT wind_speed 
                FROM radar_grid_cache 
                WHERE latitud = $1 AND longitud = $2 
                ORDER BY forecast_time DESC LIMIT 1
            `, [bestLat, bestLon]);

            if (radarRes.rowCount > 0) {
                const radarWind = radarRes.rows[0].wind_speed || 1;
                const diff = sensor.wind_speed / radarWind;
                totalSpeedDiff += diff;
                count++;
            }
        }

        const avgBias = count > 0 ? totalSpeedDiff / count : 1;
        logger.info(`[Weather AI] Sesgo local calculado: x${avgBias.toFixed(2)} (basado en ${count} sensores)`);
        return { speedFactor: avgBias };
    } catch (e) {
        logger.error('[Weather AI] Error calculando sesgo:', e.message);
        return { speedFactor: 1 };
    }
};

/**
 * Obtiene el radar pero refinado por la IA
 */
const getAiRefinedRadar = async (targetTime) => {
    const original = await getRadarData(targetTime);
    if (original.status !== 'ready') return original;

    const bias = await calculateLocalBias();
    const factor = bias ? bias.speedFactor : 1;

    // Aplicar el refinamiento IA
    const refinedData = original.data.map(node => ({
        ...node,
        wind_speed: Number((node.wind_speed * factor).toFixed(2)),
        rafagas: Number((node.rafagas * factor).toFixed(2)),
        is_ai_prediction: true
    }));

    return { 
        status: 'ready', 
        data: refinedData, 
        ai_info: { factor, model: 'BiasCorrection-v1' } 
    };
};

let cachedBiasFactor = null;
let lastBiasTime = 0;

const getCachedBias = async () => {
    const now = Date.now();
    // Cache for 15 minutes (900000 ms)
    if (cachedBiasFactor !== null && (now - lastBiasTime < 900000)) {
        return cachedBiasFactor;
    }
    
    // If a request is already calculating the bias, wait for it
    if (biasPromise) {
        return biasPromise;
    }

    biasPromise = (async () => {
        const bias = await calculateLocalBias();
        cachedBiasFactor = bias ? bias.speedFactor : 1;
        lastBiasTime = Date.now();
        biasPromise = null; // Reset the promise
        return cachedBiasFactor;
    })();

    return biasPromise;
};

/**
 * Obtiene la serie de tiempo (pronóstico) para un punto específico, refinado por IA.
 */
const getAiRefinedForecast = async (lat, lon) => {
    try {
        const factor = await getCachedBias();

        // GFS data is on a 1.0 degree grid shifted by 0.5 (e.g., -16.5, -17.5)
        // We mathematically snap the requested coordinates to the exact grid point
        const bestLat = Math.round(lat - 0.5) + 0.5;
        const bestLon = Math.round(lon - 0.5) + 0.5;

        logger.info(`[Weather AI] Querying DB for snapped coords: lat=${bestLat}, lon=${bestLon} (original: ${lat}, ${lon})`);

        // Query exactly that point directly using an index/direct match, skipping the 2M row sort
        const timeSeriesRes = await pool.query(`
            SELECT forecast_time, weather_code, cape, hlcy, refc, presion, temperatura, wind_speed, wind_direction, rafagas, rain, snow, snow_fresh, vis
            FROM radar_grid_cache
            WHERE latitud = $1 AND longitud = $2 AND forecast_time >= NOW() - INTERVAL '1 hour'
            ORDER BY forecast_time ASC
        `, [bestLat, bestLon]);

        const refinedData = timeSeriesRes.rows.map(node => ({
            ...node,
            wind_speed: node.wind_speed != null ? Number((node.wind_speed * factor).toFixed(2)) : null,
            rafagas: node.rafagas != null ? Number((node.rafagas * factor).toFixed(2)) : null,
            is_ai_prediction: true
        }));

        return {
            status: 'ready',
            data: refinedData,
            ai_info: { factor, model: 'BiasCorrection-v1' }
        };

    } catch (err) {
        console.error('[Weather AI] Detailed Error:', err);
        logger.error('[Weather AI] Error fetching forecast:', err.message);
        throw err;
    }
};

module.exports = {
    getAiRefinedRadar,
    getAiRefinedForecast
};
