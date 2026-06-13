import axios from 'axios';
import httpClient from '../config/httpClient';

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
    return null;
  }
};

export const getLatestRadarTimestamp = async () => {
  try {
    const response = await axios.get('https://api.rainviewer.com/public/weather-maps.json');
    if (response.data && response.data.radar && response.data.radar.past) {
      const pastFrames = response.data.radar.past;
      if (pastFrames.length > 0) {
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
    const res = await httpClient.get(`/sensores?_t=${Date.now()}`, { cacheTTL: false });
    const body = res.data;
    if (body?.data?.data && Array.isArray(body.data.data)) {
      return body.data.data;
    }
    return body?.data || [];
  } catch (err) {
    console.error('[Sensores IoT] Error al obtener sensores:', err);
    return [];
  }
};

/**
 * Para un punto arbitrario del mapa (clic fuera de sensores conocidos),
 * obtiene datos reales de Open-Meteo + estimación de ICA y Ruido en cliente.
 * ICA y Ruido NUNCA quedan en blanco.
 */
export const getFullDataForPoint = async (lat, lng) => {
  try {
    const response = await httpClient.get('/sensores/punto', {
      params: { lat, lng }
    });
    
    if (response.data && response.data.ok && response.data.data) {
      const d = response.data.data;
      return {
        temperatura: d.temperatura !== null ? Number(d.temperatura) : null,
        humedad: d.humedad !== null ? Number(d.humedad) : null,
        aqi: d.aqi !== null ? Number(d.aqi) : null,
        ica: d.ica !== null ? Number(d.ica) : null,
        ruido: d.ruido !== null ? Number(d.ruido) : null,
        weatherCode: d.weatherCode !== null ? Number(d.weatherCode) : null,
        windSpeed: d.windSpeed !== null ? Number(d.windSpeed) : null
      };
    }
    return null;
  } catch (err) {
    console.warn('[getFullDataForPoint] Fallback to backend failed:', err.message);
    return null;
  }
};

export const crearSensorIoT = async (sensorData) => {
  try {
    const res = await httpClient.post('/sensores', sensorData);
    return res.data;
  } catch (err) {
    console.error('[crearSensorIoT] Error creating sensor:', err);
    throw err;
  }
};

export const getSensoresMqttList = async () => {
  try {
    const res = await httpClient.get('/sensores/mqtt', { cacheTTL: false });
    return res.data?.data?.data || [];
  } catch (err) {
    console.error('[getSensoresMqttList] Error listing MQTT sensors:', err);
    return [];
  }
};

export const eliminarSensorMqtt = async (id) => {
  try {
    const res = await httpClient.delete(`/sensores/mqtt/${id}`);
    return res.data;
  } catch (err) {
    console.error('[eliminarSensorMqtt] Error deleting MQTT sensor:', err);
    throw err;
  }
};
