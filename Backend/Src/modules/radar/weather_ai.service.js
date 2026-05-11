const pool = require('../../config/db');
const { getRadarData } = require('./radar.service');

/**
 * Calcula el sesgo local (Bias) comparando NOAA con sensores reales.
 * Por ahora es una lógica simplificada que busca patrones en las últimas 24h.
 */
const calculateLocalBias = async () => {
    try {
        // 1. Obtener datos de sensores (Open-Meteo "real")
        const sensorRes = await pool.query(`
            SELECT latitud, longitud, wind_speed, temperatura 
            FROM sensores_cache
        `);
        
        // 2. Obtener datos de NOAA (Análisis f000)
        const radarRes = await getRadarData(); // Obtiene el más reciente (Análisis)
        const radarData = radarRes.data;
        
        if (sensorRes.rowCount === 0 || radarData.length === 0) return null;

        // 3. Comparar puntos cercanos (Lógica de experto local)
        // Calculamos un factor de corrección promedio para la zona
        let totalSpeedDiff = 0;
        let count = 0;

        for (const sensor of sensorRes.rows) {
            const nearestRadar = radarData.reduce((prev, curr) => {
                const dPrev = Math.hypot(prev.latitud - sensor.latitud, prev.longitud - sensor.longitud);
                const dCurr = Math.hypot(curr.latitud - sensor.latitud, curr.longitud - sensor.longitud);
                return dCurr < dPrev ? curr : prev;
            });

            if (nearestRadar) {
                const diff = sensor.wind_speed / (nearestRadar.wind_speed || 1);
                totalSpeedDiff += diff;
                count++;
            }
        }

        const avgBias = count > 0 ? totalSpeedDiff / count : 1;
        console.log(`[Weather AI] Sesgo local calculado: x${avgBias.toFixed(2)} (basado en ${count} sensores)`);
        return { speedFactor: avgBias };
    } catch (e) {
        console.error('[Weather AI] Error calculando sesgo:', e.message);
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

module.exports = {
    getAiRefinedRadar
};
