import { useMemo, useState, useEffect, useRef } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import voronoi from '@turf/voronoi'
import { intersect } from '@turf/intersect'
import { featureCollection, point } from '@turf/helpers'
import { colorPorValor, umbralPorValor } from '../../../hooks/useUmbrales'

/**
 * VoronoiLayer — Manto territorial coloreado por umbral.
 *
 * Cada estación del simulador "posee" la región más cercana a ella (celda
 * Voronoi). Las celdas se recortan EXACTAMENTE contra los contornos reales
 * de los países sudamericanos vía @turf/intersect, por lo que ningún color
 * sangra al océano. Sin máscaras, sin canvas, sin gradientes inventados:
 * cada región muestra el color del umbral del valor real de su estación.
 *
 * Optimización en dos fases:
 *   1. Geometría (cara): se recomputa solo cuando cambian las POSICIONES
 *      de las ciudades, NO en cada tick de simulación.
 *   2. Colores (barata): se recompone cada tick desde la geometría cacheada.
 */

const SA_BBOX = [-85, -58, -30, 15]

const SA_COUNTRIES = new Set([
  'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE',
])

const GEO_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

let _cachedSAGeo = null

async function fetchSAGeoJSON() {
  if (_cachedSAGeo) return _cachedSAGeo
  const res = await fetch(GEO_URL)
  const data = await res.json()
  _cachedSAGeo = {
    type: 'FeatureCollection',
    features: data.features.filter(f => SA_COUNTRIES.has(f.properties?.ISO_A2)),
  }
  return _cachedSAGeo
}

function buildClippedGeometry(cities, saGeoJSON) {
  if (!cities?.length || !saGeoJSON) return null

  const pts = cities
    .filter(c => c.longitude != null && c.latitude != null)
    .map(c => point([c.longitude, c.latitude], { cityId: c.id }))

  if (pts.length < 3) return null

  const voronoiPolys = voronoi(featureCollection(pts), { bbox: SA_BBOX })
  if (!voronoiPolys?.features?.length) return null

  const features = []

  voronoiPolys.features.forEach((poly, i) => {
    if (!poly) return
    const srcPt = pts[i]
    if (!srcPt) return

    for (const country of saGeoJSON.features) {
      try {
        const clipped = intersect(featureCollection([poly, country]))
        if (clipped) {
          features.push({
            type: 'Feature',
            geometry: clipped.geometry,
            properties: { cityId: srcPt.properties.cityId },
          })
        }
      } catch (_) {
        // geometrías inválidas — se omiten silenciosamente
      }
    }
  })

  return { type: 'FeatureCollection', features }
}

function addColors(clippedGeometry, cities, metrica, umbrales, activeFilter) {
  const cityMap = Object.fromEntries(cities.map(c => [c.id, c]))

  return {
    ...clippedGeometry,
    features: clippedGeometry.features.map(f => {
      const city = cityMap[f.properties.cityId]
      const value = city?.data?.[metrica] ?? 0
      const umbral = umbralPorValor(umbrales, value)
      const inRange =
        !activeFilter ||
        (umbral?.nivel === activeFilter.nivel)
      return {
        ...f,
        properties: {
          ...f.properties,
          fillColor: umbral?.color_hex ?? '#666',
          value,
          opacity: inRange ? 0.78 : 0,
        },
      }
    }),
  }
}

export default function VoronoiLayer({ metrica, umbrales, cities, activeFilter }) {
  const [saGeoJSON, setSaGeoJSON] = useState(null)
  const [clippedGeometry, setClippedGeometry] = useState(null)
  const prevPositionsRef = useRef(null)

  useEffect(() => {
    fetchSAGeoJSON()
      .then(setSaGeoJSON)
      .catch(err => console.error('[VoronoiLayer]', err))
  }, [])

  // Geometría: recomputa solo si cambian las POSICIONES de las ciudades
  useEffect(() => {
    if (!saGeoJSON || !cities?.length || !umbrales.length) return

    const posKey = cities
      .filter(c => c.longitude != null && c.latitude != null)
      .map(c => `${c.id}:${c.longitude.toFixed(4)},${c.latitude.toFixed(4)}`)
      .join('|')

    if (posKey === prevPositionsRef.current) return
    prevPositionsRef.current = posKey

    setClippedGeometry(buildClippedGeometry(cities, saGeoJSON))
  }, [cities, saGeoJSON, umbrales.length])

  // Colores: barato, corre cada tick
  const voronoiGeo = useMemo(() => {
    if (!clippedGeometry || !umbrales.length) return null
    return addColors(clippedGeometry, cities, metrica, umbrales, activeFilter)
  }, [clippedGeometry, cities, metrica, umbrales, activeFilter])

  if (!voronoiGeo) return null

  return (
    <Source id="voronoi-source" type="geojson" data={voronoiGeo}>
      <Layer
        id="voronoi-fill"
        type="fill"
        paint={{
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['get', 'opacity'],
          'fill-color-transition': { duration: 600, delay: 0 },
          'fill-opacity-transition': { duration: 300, delay: 0 },
        }}
      />
      <Layer
        id="voronoi-border"
        type="line"
        paint={{
          'line-color': 'rgba(255,255,255,0.22)',
          'line-width': 0.8,
        }}
      />
    </Source>
  )
}
