import React from 'react'
import { Marker } from 'react-map-gl/mapbox'
import { colorPorValor, umbralPorValor } from '../../../hooks/useUmbrales'

/**
 * Marcadores circulares coloreados según umbral de la métrica activa.
 * Siempre visibles cuando el heatmap está ON para dar contexto preciso por ciudad.
 *
 * Props:
 *   cities         {Array}    – { id, name, latitude, longitude, data, fuente_id? }
 *   metrica        {string}   – clave activa ("aqi", "temperatura", etc.)
 *   umbrales       {Array}    – resultado de useUmbrales()
 *   getFuenteLabel {Function} – (city) => string | null — badge de fuente de datos
 *   onCityClick    {Function} – callback(city)
 */
export default function MarkersLayer({ cities, metrica, umbrales, getFuenteLabel, onCityClick }) {
  if (!cities?.length || !umbrales.length) return null

  return cities.map(city => {
    const valor    = city.data?.[metrica] ?? 0
    const color    = colorPorValor(umbrales, valor)
    const umbral   = umbralPorValor(umbrales, valor)
    const critico  = ['critica', 'emergencia'].includes(umbral?.severidad)
    const fuenteLabel = getFuenteLabel?.(city) ?? null

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
          {fuenteLabel && (
            <span className={`marker-source-badge${fuenteLabel.startsWith('En vivo') ? ' marker-source-badge--sim' : ' marker-source-badge--real'}`}>
              {fuenteLabel}
            </span>
          )}
        </div>
      </Marker>
    )
  })
}
