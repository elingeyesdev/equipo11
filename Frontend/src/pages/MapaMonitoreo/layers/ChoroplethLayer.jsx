import { useEffect, useState, useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import { colorPorValor, umbralPorValor } from '../../../hooks/useUmbrales'
import { API_BASE } from '../../../config/api'

const ENDPOINT = `${API_BASE}/geografia/regiones-geojson`

let _cachedGeoJSON = null

/**
 * ChoroplethLayer — Mapa de coropletas por división administrativa (ADM1).
 *
 * Obtiene los polígonos GeoJSON desde /api/geografia/regiones-geojson y
 * colorea cada división según el valor de la métrica activa, usando la
 * ciudad más cercana como fuente de datos.
 *
 * Usa el mismo sistema de umbrales y colores que VoronoiLayer para
 * mantener consistencia visual.
 */
export default function ChoroplethLayer({ metrica, umbrales, cities, activeFilter }) {
  const [regionGeo, setRegionGeo] = useState(null)

  useEffect(() => {
    if (!_cachedGeoJSON) {
      fetch(ENDPOINT)
        .then(r => r.json())
        .then(data => { _cachedGeoJSON = data; setRegionGeo(data) })
        .catch(err => console.error('[ChoroplethLayer] Error fetching:', err))
    } else {
      setRegionGeo(_cachedGeoJSON)
    }
  }, [])

  const enrichedGeo = useMemo(() => {
    if (!regionGeo?.features?.length || !cities?.length || !umbrales.length) return null

    return {
      type: 'FeatureCollection',
      features: regionGeo.features.map(feat => {
        const centroid = getCentroid(feat.geometry)
        const nearest  = getNearestCity(centroid, cities)
        const value    = nearest?.data?.[metrica] ?? 0
        const umbral   = umbralPorValor(umbrales, value)
        const inRange  = !activeFilter || (umbral?.nivel === activeFilter.nivel)

        return {
          ...feat,
          properties: {
            ...feat.properties,
            fillColor: umbral?.color_hex ?? '#666',
            value,
            opacity: inRange ? 0.6 : 0,
          },
        }
      }),
    }
  }, [regionGeo, cities, metrica, umbrales, activeFilter])

  if (!enrichedGeo) return null

  return (
    <Source id="choropleth-source" type="geojson" data={enrichedGeo}>
      <Layer
        id="depto-fill"
        type="fill"
        paint={{
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['get', 'opacity'],
          'fill-color-transition': { duration: 500, delay: 0 },
          'fill-opacity-transition': { duration: 300, delay: 0 },
        }}
      />
      <Layer
        id="depto-outline"
        type="line"
        paint={{
          'line-color': 'rgba(255,255,255,0.18)',
          'line-width': 0.6,
        }}
      />
    </Source>
  )
}

function getCentroid(geometry) {
  try {
    const ring =
      geometry.type === 'Polygon'
        ? geometry.coordinates[0]
        : geometry.coordinates[0][0]
    return {
      lng: ring.reduce((s, c) => s + c[0], 0) / ring.length,
      lat: ring.reduce((s, c) => s + c[1], 0) / ring.length,
    }
  } catch (_) {
    return { lng: 0, lat: 0 }
  }
}

function getNearestCity(centroid, cities) {
  return cities.reduce((best, city) => {
    const d  = Math.hypot(city.longitude - centroid.lng, city.latitude - centroid.lat)
    const bd = best
      ? Math.hypot(best.longitude - centroid.lng, best.latitude - centroid.lat)
      : Infinity
    return d < bd ? city : best
  }, null)
}
