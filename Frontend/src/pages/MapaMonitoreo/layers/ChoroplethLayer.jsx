import React, { useEffect, useState } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import { buildMapboxColorExpr } from '../../../hooks/useUmbrales'

const WORLD_GEOJSON_URL =
  'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'

// Caché a nivel de módulo para no refetchear entre renders/remounts
let _worldCache = null

export default function ChoroplethLayer({ metrica, umbrales, cities }) {
  const [geoData, setGeoData] = useState(null)

  useEffect(() => {
    if (!cities?.length || !umbrales.length) return

    const enrich = (base) => setGeoData(enrichGeoJSON(base, cities, metrica))

    if (_worldCache) {
      enrich(_worldCache)
      return
    }

    fetch(WORLD_GEOJSON_URL)
      .then(r => r.json())
      .then(data => { _worldCache = data; enrich(data) })
      .catch(e => console.error('[ChoroplethLayer]', e))
  }, [cities, metrica, umbrales])

  if (!geoData || !umbrales.length) return null

  const colorExpr = buildMapboxColorExpr(umbrales, 'val')

  return (
    <Source id="choropleth-source" type="geojson" data={geoData}>
      <Layer
        id="depto-fill"
        type="fill"
        paint={{
          'fill-color': colorExpr,
          'fill-opacity': 0.6,
          'fill-color-transition': { duration: 500, delay: 0 },
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

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function enrichGeoJSON(geojson, cities, metrica) {
  return {
    ...geojson,
    features: geojson.features.map(feat => {
      const centroid = getCentroid(feat.geometry)
      const nearest  = getNearestCity(centroid, cities)
      return {
        ...feat,
        properties: { ...feat.properties, val: nearest?.data?.[metrica] ?? 0 },
      }
    }),
  }
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
