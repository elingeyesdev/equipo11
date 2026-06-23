const pool = require('../../config/db');
const logger = require('../../utils/logger');

/**
 * Consulta la tabla radar_grid_cache para obtener los datos meteorológicos crudos
 * más cercanos a una latitud y longitud dada.
 */
async function consultarDatosRadar(lat, lon) {
    try {
        const query = `
            SELECT 
                latitud, 
                longitud, 
                forecast_time, 
                temperatura, 
                wind_speed as velocidad_viento, 
                wind_direction as direccion_viento,
                presion,
                ((latitud - $1) * (latitud - $1) + (longitud - $2) * (longitud - $2)) as distancia
            FROM radar_grid_cache
            ORDER BY distancia ASC
            LIMIT 1;
        `;
        const res = await pool.query(query, [lat, lon]);
        
        if (res.rowCount === 0) {
            return JSON.stringify({ error: "No hay datos globales de radar disponibles cerca de estas coordenadas." });
        }
        
        const data = res.rows[0];
        
        // Conversión a grados si temperatura está en Kelvin (opcional dependiendo de cómo se guardó)
        let tempC = data.temperatura;
        if (tempC > 150) tempC = (tempC - 273.15).toFixed(1);

        return JSON.stringify({
            latitud_grilla: data.latitud,
            longitud_grilla: data.longitud,
            forecast_time: data.forecast_time,
            temperatura_C: Number(tempC),
            velocidad_viento_kmh: Number(data.velocidad_viento),
            direccion_viento: Number(data.direccion_viento),
            presion_hpa: Number(data.presion)
        });

    } catch (err) {
        logger.error({ err }, '[Meteoro Tools] Error consultando radar cache');
        return JSON.stringify({ error: "Ocurrió un error consultando la base de datos de radar." });
    }
}

/**
 * Consulta la API de Archivo Histórico de Open-Meteo para obtener
 * el día más caluroso, frío o lluvioso en un rango de fechas.
 */
async function consultarHistoricoClima(lat, lon, startDate, endDate) {
    try {
        if (!lat || !lon || !startDate || !endDate) return JSON.stringify({ error: "Faltan parámetros de fecha o coordenadas." });
        
        // Open-Meteo Archive API requires dates in YYYY-MM-DD
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,rain_sum&timezone=auto`;
        const res = await fetch(url);
        
        if (!res.ok) return JSON.stringify({ error: "No se pudo obtener el historial de Open-Meteo." });
        
        const data = await res.json();
        if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
            return JSON.stringify({ error: "No se encontraron datos históricos para ese rango." });
        }

        // Buscar el día más caluroso en el rango
        let maxTemp = -999;
        let maxTempDate = null;
        let rainSum = 0;

        for (let i = 0; i < data.daily.time.length; i++) {
            const temp = data.daily.temperature_2m_max[i];
            rainSum += data.daily.rain_sum[i] || 0;
            if (temp > maxTemp) {
                maxTemp = temp;
                maxTempDate = data.daily.time[i];
            }
        }

        return JSON.stringify({
            ubicacion: { lat, lon },
            rango: `${startDate} a ${endDate}`,
            dia_mas_caluroso: { fecha: maxTempDate, temperatura_maxima_C: maxTemp },
            lluvia_total_mm: rainSum
        });

    } catch (err) {
        logger.error({ err }, '[Meteoro Tools] Error consultando Open-Meteo Archive');
        return JSON.stringify({ error: "Ocurrió un error al consultar la API histórica global." });
    }
}

/**
 * Consulta la API de Nominatim y ReliefWeb para buscar desastres activos o recientes
 * en la ubicación especificada.
 */
async function investigarDesastresGlobales(lat, lon) {
    try {
        // 1. Reverse Geocoding para obtener el país
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
            headers: { 'User-Agent': 'EnviroSense/1.0' }
        });
        
        if (!nomRes.ok) return JSON.stringify({ error: "No se pudo determinar el país geográficamente." });
        
        const nomData = await nomRes.json();
        const country = nomData.address?.country;
        
        if (!country) return JSON.stringify({ error: "Las coordenadas apuntan al océano o a una zona sin nombre de país definido." });

        // 2. Consultar Wikipedia (Inglés) para encontrar desastres recientes en ese país
        // Usamos inglés porque tiene la base de datos más extensa de eventos mundiales
        const year = new Date().getFullYear();
        const searchQuery = encodeURIComponent(`disaster ${country} ${year} OR climate extreme ${country} ${year}`);
        const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json`);

        if (!wikiRes.ok) return JSON.stringify({ error: "Error consultando la base de datos global de noticias (Wikipedia)." });

        const wikiData = await wikiRes.json();
        const desastres = wikiData.query.search ? wikiData.query.search.slice(0, 3).map(d => ({
            titulo: d.title,
            resumen: d.snippet.replace(/<[^>]*>?/gm, '') // Limpiar HTML del snippet
        })) : [];

        return JSON.stringify({
            pais_detectado: country,
            desastres_recientes: desastres.length > 0 ? desastres : "No hay desastres mayores reportados en Wikipedia recientemente para este país."
        });

    } catch (err) {
        logger.error({ err }, '[Meteoro Tools] Error consultando APIs externas de desastres');
        return JSON.stringify({ error: "Ocurrió un error al investigar las noticias de desastres." });
    }
}

// Definición de las herramientas para DeepSeek
const toolDefinitions = [
    {
        type: "function",
        function: {
            name: "consultar_datos_radar",
            description: "Obtiene los datos meteorológicos actuales (temperatura, viento, presión) para una coordenada desde la base de datos de radar local.",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number", description: "Latitud (-90 a 90)" },
                    lon: { type: "number", description: "Longitud (-180 a 180)" }
                },
                required: ["lat", "lon"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "consultar_historico_clima",
            description: "Obtiene datos históricos reales mundiales (temperaturas máximas, lluvia) de la API global para un rango de fechas. ÚSALO cuando el usuario pregunte por el día más caluroso, frío o datos de años/meses pasados.",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number", description: "Latitud (-90 a 90)" },
                    lon: { type: "number", description: "Longitud (-180 a 180)" },
                    startDate: { type: "string", description: "Fecha de inicio (YYYY-MM-DD)" },
                    endDate: { type: "string", description: "Fecha de fin (YYYY-MM-DD)" }
                },
                required: ["lat", "lon", "startDate", "endDate"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "investigar_desastres_globales",
            description: "Busca en la base de datos mundial de desastres (ONU/ReliefWeb) para encontrar eventos severos recientes (incendios, inundaciones, huracanes, sequías) basados en las coordenadas geográficas.",
            parameters: {
                type: "object",
                properties: {
                    lat: {
                        type: "number",
                        description: "Latitud de la ubicación"
                    },
                    lon: {
                        type: "number",
                        description: "Longitud de la ubicación"
                    }
                },
                required: ["lat", "lon"]
            }
        }
    }
];

module.exports = {
    consultarDatosRadar,
    consultarHistoricoClima,
    investigarDesastresGlobales,
    toolDefinitions
};
