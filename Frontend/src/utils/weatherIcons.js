export const weatherCodeMap = {
  0: { label: 'Despejado', emoji: '☀️', iconClass: 'weather-clear' },
  1: { label: 'Mayormente despejado', emoji: '🌤️', iconClass: 'weather-few-clouds' },
  2: { label: 'Parcialmente nublado', emoji: '⛅', iconClass: 'weather-partly-cloudy' },
  3: { label: 'Nublado', emoji: '☁️', iconClass: 'weather-cloudy' },
  45: { label: 'Niebla', emoji: '🌫️', iconClass: 'weather-fog' },
  48: { label: 'Niebla escarchada', emoji: '🌫️', iconClass: 'weather-fog' },
  51: { label: 'Llovizna ligera', emoji: '🌧️', iconClass: 'weather-drizzle' },
  53: { label: 'Llovizna moderada', emoji: '🌧️', iconClass: 'weather-drizzle' },
  55: { label: 'Llovizna densa', emoji: '🌧️', iconClass: 'weather-drizzle' },
  56: { label: 'Llovizna helada ligera', emoji: '🌧️', iconClass: 'weather-drizzle' },
  57: { label: 'Llovizna helada densa', emoji: '🌧️', iconClass: 'weather-drizzle' },
  61: { label: 'Lluvia ligera', emoji: '🌦️', iconClass: 'weather-rain-light' },
  63: { label: 'Lluvia moderada', emoji: '🌧️', iconClass: 'weather-rain' },
  65: { label: 'Lluvia fuerte', emoji: '🌧️', iconClass: 'weather-rain-heavy' },
  66: { label: 'Lluvia helada ligera', emoji: '🌧️', iconClass: 'weather-rain' },
  67: { label: 'Lluvia helada fuerte', emoji: '🌧️', iconClass: 'weather-rain-heavy' },
  71: { label: 'Nieve ligera', emoji: '🌨️', iconClass: 'weather-snow-light' },
  73: { label: 'Nieve moderada', emoji: '🌨️', iconClass: 'weather-snow' },
  75: { label: 'Nieve fuerte', emoji: '❄️', iconClass: 'weather-snow-heavy' },
  77: { label: 'Granizo de nieve', emoji: '🌨️', iconClass: 'weather-snow' },
  80: { label: 'Chubascos ligeros', emoji: '🌦️', iconClass: 'weather-showers' },
  81: { label: 'Chubascos moderados', emoji: '🌧️', iconClass: 'weather-showers' },
  82: { label: 'Chubascos violentos', emoji: '🌧️', iconClass: 'weather-showers-heavy' },
  85: { label: 'Chubascos de nieve ligeros', emoji: '🌨️', iconClass: 'weather-snow-showers' },
  86: { label: 'Chubascos de nieve fuertes', emoji: '❄️', iconClass: 'weather-snow-showers' },
  95: { label: 'Tormenta eléctrica', emoji: '⛈️', iconClass: 'weather-thunderstorm' },
  96: { label: 'Tormenta con granizo ligero', emoji: '⛈️', iconClass: 'weather-thunderstorm-hail' },
  99: { label: 'Tormenta con granizo fuerte', emoji: '⛈️', iconClass: 'weather-thunderstorm-hail' },
}

export function getWeatherInfo(code) {
  return weatherCodeMap[code] || { label: 'Desconocido', emoji: '❓', iconClass: 'weather-unknown' }
}
