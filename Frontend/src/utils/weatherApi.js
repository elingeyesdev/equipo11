import axios from 'axios';
import { API_BASE } from '../config/api';

// Get current weather from Open-Meteo
export const getWeatherAtLocation = async (lat, lng) => {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lng,
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
        timezone: 'auto'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
};

// Get AQI from Open-Meteo Air Quality API
export const getAqiAtLocation = async (lat, lng) => {
  try {
    const response = await axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
      params: {
        latitude: lat,
        longitude: lng,
        current: 'european_aqi',
        timezone: 'auto'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching AQI:', error);
    return null;
  }
};

// Mapbox Geocoding for reverse geolocation (fetching name of the place)
export const getPlaceName = async (lat, lng, mapboxToken) => {
  try {
    const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`, {
      params: {
        access_token: mapboxToken,
        language: 'es'
      }
    });
    
    const features = response.data.features;
    if (features && features.length > 0) {
      // Find the most specific place name
      const place = features.find(f => f.place_type.includes('place') || f.place_type.includes('locality')) || features[0];
      return place.text;
    }
    return null;
  } catch (error) {
    console.error('Error fetching place name:', error);
    return null;
  }
};

export const getBulkWeatherForLocations = async (citiesArray) => {
  if (!citiesArray || citiesArray.length === 0) return {};
  
  const lats = citiesArray.map(c => c.latitude).join(',');
  const lngs = citiesArray.map(c => c.longitude).join(',');

  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lats,
        longitude: lngs,
        current: 'weather_code',
        timezone: 'auto'
      }
    });

    const results = {};
    const data = response.data;
    
    // Si OpenMeteo recibe múltiples coordenadas, devuelve un array. Si es una, devuelve un objeto.
    if (Array.isArray(data)) {
      data.forEach((locData, index) => {
        if (locData && locData.current) {
          results[citiesArray[index].id] = locData.current.weather_code;
        }
      });
    } else if (data && data.current) {
      results[citiesArray[0].id] = data.current.weather_code;
    }
    
    return results;
  } catch (error) {
    console.error("Error bulk fetching weather from Open-Meteo:", error);
    return {};
  }
};

export const getHistoricalWeatherAtLocation = async (lat, lng) => {
  try {
    const [weatherResponse, aqiResponse] = await Promise.all([
      axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lng,
          hourly: 'temperature_2m,relative_humidity_2m,weather_code',
          past_days: 1,
          forecast_days: 1,
          timezone: 'auto'
        }
      }),
      axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
        params: {
          latitude: lat,
          longitude: lng,
          hourly: 'european_aqi',
          past_days: 1,
          forecast_days: 1,
          timezone: 'auto'
        }
      })
    ]);
    
    // Transformamos el dato masivo de Open-Meteo al formato Timeline
    const { time, temperature_2m, relative_humidity_2m, weather_code } = weatherResponse.data.hourly;
    const aqiData = aqiResponse.data?.hourly?.european_aqi || [];
    
    const mappedArray = time.map((timestampStr, idx) => ({
      index: idx,
      timestamp: timestampStr, 
      data: {
        temperatura: temperature_2m[idx],
        weatherCode: weather_code[idx],
        aqi: aqiData[idx] || null,
        ica: null,
        ruido: null,
        humedad: relative_humidity_2m[idx]
      }
    }));
    
    return mappedArray;
  } catch (error) {
    console.error('Error fetching historical weather from API:', error);
    return null;
  }
};

export const getGlobalGridWeather = async (pointsArray) => {
  if (!pointsArray || pointsArray.length === 0) return [];
  
  const lats = pointsArray.map(p => p.latitude).join(',');
  const lngs = pointsArray.map(p => p.longitude).join(',');

  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lats,
        longitude: lngs,
        current: 'weather_code',
        timezone: 'auto'
      }
    });

    const data = response.data;
    const results = Array.isArray(data) ? data : [data];
    
    return pointsArray.map((p, index) => ({
      ...p,
      weatherCode: results[index]?.current?.weather_code || null
    }));
  } catch (error) {
    console.error("Error bulk fetching grid weather:", error);
    return null; // Devolver null para no borrar la cuadrícula previa en caso de rate-limit
  }
};

export const getLatestRadarTimestamp = async () => {
  try {
    const response = await axios.get('https://api.rainviewer.com/public/weather-maps.json');
    if (response.data && response.data.radar && response.data.radar.past) {
      const pastFrames = response.data.radar.past;
      if (pastFrames.length > 0) {
        // Tomamos el cuadro más reciente del pasado (el último del array)
        return pastFrames[pastFrames.length - 1].time;
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching RainViewer timestamp:", error);
    return null;
  }
};

/**
 * Obtiene todos los sensores IoT con sus últimas lecturas reales desde el backend.
 */
export const getSensoresIoT = async () => {
  try {
    const res = await axios.get(`${API_BASE}/sensores`);
    return res.data?.data || [];
  } catch (err) {
    console.error('[Sensores IoT] Error al obtener sensores:', err);
    return [];
  }
};
/**
 * Estima ICA (calidad del agua, 0–100) a partir de datos climáticos reales.
 * - Humedad alta → más disponibilidad de agua pero potencialmente más contaminada
 * - AQI alto → correlación negativa con calidad del agua
 * - Lluvia (weatherCode 51-82) → leve deterioro por arrastre de sedimentos
 */
const estimateICA = (humedad, aqi, weatherCode) => {
  const humNorm = Math.max(0, Math.min(1, humedad / 100));
  const aqiNorm = Math.max(0, Math.min(1, (aqi || 0) / 200));
  const isRaining = weatherCode >= 51 && weatherCode <= 82;

  // Base: 80 puntos, baja con AQI alto, sube un poco con humedad
  let ica = 80 - aqiNorm * 45 + humNorm * 8 - (isRaining ? 4 : 0);
  // Añadir variación aleatoria pequeña (±3) para no ser perfectamente lineal
  ica += (Math.random() - 0.5) * 6;
  return Number(Math.max(10, Math.min(100, ica)).toFixed(1));
};

/**
 * Estima el nivel de Ruido (dB) basado en la hora del día.
 * Pico en hora punta (7-9h y 17-20h), silencio nocturno (0-6h).
 */
const estimateRuido = () => {
  const hour = new Date().getHours();
  let factor;
  if (hour >= 0 && hour < 6)        factor = 0.15;  // madrugada
  else if (hour >= 6 && hour < 7)   factor = 0.35;  // amanecer
  else if (hour >= 7 && hour <= 9)  factor = 0.85;  // hora punta mañana
  else if (hour >= 10 && hour < 17) factor = 0.60;  // día laboral
  else if (hour >= 17 && hour <= 20) factor = 0.90; // hora punta tarde
  else if (hour >= 21 && hour < 23) factor = 0.45;  // noche
  else                              factor = 0.20;  // medianoche

  // Rango urbano genérico: 35–85 dB
  const ruido = 35 + factor * 50 + (Math.random() - 0.5) * 4;
  return Number(Math.max(30, Math.min(90, ruido)).toFixed(1));
};

/**
 * Para un punto arbitrario del mapa (clic fuera de sensores conocidos),
 * obtiene datos reales de Open-Meteo + estimación de ICA y Ruido en cliente.
 * ICA y Ruido NUNCA quedan en blanco.
 */
export const getFullDataForPoint = async (lat, lng) => {
  try {
    const [wRes, aRes] = await Promise.all([
      axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat, longitude: lng,
          current: 'temperature_2m,relative_humidity_2m,weather_code',
          timezone: 'auto'
        }
      }),
      axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
        params: {
          latitude: lat, longitude: lng,
          current: 'european_aqi',
          timezone: 'auto'
        }
      })
    ]);

    const temperatura  = wRes.data?.current?.temperature_2m         ?? null;
    const humedad      = wRes.data?.current?.relative_humidity_2m   ?? null;
    const weatherCode  = wRes.data?.current?.weather_code           ?? null;
    const aqi          = aRes.data?.current?.european_aqi           ?? null;

    // Estimar ICA y Ruido con datos reales — nunca quedan en blanco
    const ica   = (humedad !== null) ? estimateICA(humedad, aqi ?? 50, weatherCode ?? 0) : null;
    const ruido = estimateRuido();

    return { temperatura, humedad, aqi, ica, ruido, weatherCode };
  } catch (err) {
    console.error('[getFullDataForPoint] Error al obtener datos:', err.message);
    return null;
  }
};
