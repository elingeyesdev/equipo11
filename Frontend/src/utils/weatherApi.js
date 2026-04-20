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
