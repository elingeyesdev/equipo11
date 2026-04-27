import React from 'react'
import { Marker } from 'react-map-gl/mapbox'
import { colorPorValor, umbralPorValor } from '../../../hooks/useUmbrales'

/**
 * Marcadores circulares coloreados según umbral de la métrica activa.
 * Siempre visibles cuando el heatmap está ON para dar contexto preciso por ciudad.
 *
 * Props:
 *   cities      {Array}    – { id, name, latitude, longitude, data }
 *   metrica     {string}   – clave activa ("aqi", "temperatura", etc.)
 *   umbrales    {Array}    – resultado de useUmbrales()
 *   onCityClick {Function} – callback(city)
 */
export default function MarkersLayer({ cities, metrica, umbrales, onCityClick }) {
  if (!cities?.length || !umbrales.length) return null

  return cities.map(city => {
    const valor    = city.data?.[metrica] ?? 0
    const color    = colorPorValor(umbrales, valor)
    const umbral   = umbralPorValor(umbrales, valor)
    const critico  = ['critica', 'emergencia'].includes(umbral?.severidad)

    return (
      <Marker
        key={city.id}
        latitude={city.latitude}
        longitude={city.longitude}
        anchor="center"
        onClick={e => { e.originalEvent.stopPropagation(); onCityClick?.(city) }}
      >
        <div
          className={`city-marker${critico ? ' city-marker--pulse' : ''}`}
          style={{ '--marker-color': color }}
          title={`${city.name}: ${Math.round(valor)}`}
        >
          <span className="city-marker__value">{Math.round(valor)}</span>
        </div>
      </Marker>
    )
  })
}
