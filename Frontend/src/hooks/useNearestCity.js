import { useMemo } from 'react'
import { FALLBACK_DATA } from '../data/fallbackData'

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function useNearestCity(coords, cities = null) {
  const data = cities || FALLBACK_DATA

  return useMemo(() => {
    if (!coords) return null
    let nearest = null
    let minDist = Infinity
    for (const city of data) {
      const dist = haversineKm(coords.lat, coords.lon, city.latitude, city.longitude)
      if (dist < minDist) {
        minDist = dist
        nearest = city
      }
    }
    return nearest ? { ...nearest, distanceKm: Math.round(minDist) } : null
  }, [coords, data])
}
