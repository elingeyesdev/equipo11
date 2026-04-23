import axios from 'axios';

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
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lng,
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
        past_days: 1,
        forecast_days: 1,
        timezone: 'auto' // Esto asegurará que los timesamps vengan alineados
      }
    });
    
    // Transformamos el dato masivo de Open-Meteo al formato Timeline
    const { time, temperature_2m, relative_humidity_2m, wind_speed_10m, weather_code } = response.data.hourly;
    
    const mappedArray = time.map((timestampStr, idx) => ({
      index: idx,
      timestamp: timestampStr, // Open-Meteo retorna strings ISO o truncadas "YYYY-MM-DDTHH:00"
      data: {
        temperature: temperature_2m[idx],
        weatherCode: weather_code[idx],
        aqi: null, // Limitación: APIs genéricas no proveen histórico consolidado
        waterQuality: null,
        noise: null,
        humidity: relative_humidity_2m[idx],
        wind: wind_speed_10m[idx]
      }
    }));
    
    return mappedArray;
  } catch (error) {
    console.error('Error fetching historical weather from API:', error);
    return null;
  }
};
