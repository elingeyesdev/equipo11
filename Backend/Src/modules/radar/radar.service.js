/**
 * Radar Forecast Service
 *
 * Provides 96-hour weather forecast data for any lat/lon coordinate
 * using the Open-Meteo Forecast API (free, no key needed).
 *
 * Returns: forecast_time, temperatura, rain, wind_speed, vis
 * which is exactly what the frontend hooks (useForecastData, useMultiForecastData) expect.
 */

const logger = require('../../utils/logger')

// In-memory cache: key = "lat,lon" → { data, fetchedAt }
const forecastCache = new Map()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Fetch enriched forecast from Open-Meteo for a single coordinate.
 * Returns { current, hourly, daily }
 */
async function fetchForecast(lat, lon) {
  const cacheKey = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`
  const cached = forecastCache.get(cacheKey)

  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.data
  }

  const currentParams = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m'
  const hourlyParams = 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,visibility,uv_index'
  const dailyParams = 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'

  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lat}&longitude=${lon}`
    + `&current=${currentParams}`
    + `&hourly=${hourlyParams}`
    + `&daily=${dailyParams}`
    + `&forecast_days=7`
    + `&timezone=auto`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast HTTP ${res.status}`)
  }

  const json = await res.json()
  const { current, hourly, daily } = json

  if (!hourly || !hourly.time || !daily || !daily.time) {
    throw new Error('Open-Meteo returned unexpected format')
  }

  // uv_index no siempre viene en current, sacar de hourly si es necesario (el de la hora actual)
  const currentHourIndex = hourly.time.findIndex(t => new Date(t).getTime() >= new Date().getTime())
  const currentUvIndex = currentHourIndex >= 0 ? hourly.uv_index?.[currentHourIndex] : 0

  const data = {
    current: {
      temperatura: current.temperature_2m ?? 0,
      sensacion_termica: current.apparent_temperature ?? 0,
      humedad: current.relative_humidity_2m ?? 0,
      precipitacion_prob: current.precipitation_probability ?? 0,
      weather_code: current.weather_code ?? 0,
      nubosidad: current.cloud_cover ?? 0,
      presion: current.pressure_msl ?? 1013,
      viento_velocidad: current.wind_speed_10m ?? 0,
      viento_direccion: current.wind_direction_10m ?? 0,
      uv_index: currentUvIndex ?? 0
    },
    hourly: hourly.time.map((t, i) => ({
      forecast_time: new Date(t).toISOString(),
      temperatura: hourly.temperature_2m?.[i] ?? 0,
      sensacion_termica: hourly.apparent_temperature?.[i] ?? 0,
      humedad: hourly.relative_humidity_2m?.[i] ?? 0,
      precipitacion_prob: hourly.precipitation_probability?.[i] ?? 0,
      rain: hourly.rain?.[i] ?? 0,
      weather_code: hourly.weather_code?.[i] ?? 0,
      nubosidad: hourly.cloud_cover?.[i] ?? 0,
      presion: hourly.pressure_msl?.[i] ?? 1013,
      wind_speed: hourly.wind_speed_10m?.[i] ?? 0,
      viento_direccion: hourly.wind_direction_10m?.[i] ?? 0,
      vis: hourly.visibility?.[i] ?? 10000,
      uv_index: hourly.uv_index?.[i] ?? 0
    })),
    daily: daily.time.map((t, i) => ({
      date: t, // "YYYY-MM-DD"
      temp_max: daily.temperature_2m_max?.[i] ?? 0,
      temp_min: daily.temperature_2m_min?.[i] ?? 0,
      weather_code: daily.weather_code?.[i] ?? 0,
      precipitacion_total: daily.precipitation_sum?.[i] ?? 0,
      precipitacion_prob_max: daily.precipitation_probability_max?.[i] ?? 0,
      viento_max: daily.wind_speed_10m_max?.[i] ?? 0,
      uv_max: daily.uv_index_max?.[i] ?? 0,
      amanecer: daily.sunrise?.[i] ?? '',
      atardecer: daily.sunset?.[i] ?? ''
    }))
  }

  forecastCache.set(cacheKey, { data, fetchedAt: Date.now() })
  logger.info(`[radar.service] Cached enriched forecast for (${lat}, ${lon})`)

  return data
}

module.exports = { fetchForecast }
