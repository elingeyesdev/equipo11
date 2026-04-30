import React from 'react'
import { Marker } from 'react-map-gl/mapbox'
import { colorPorValor, umbralPorValor } from '../../../hooks/useUmbrales'
import { convertirValor } from '../../../utils/unidades'

/**
 * Marcadores circulares coloreados según umbral de la métrica activa.
 * Siempre visibles cuando el heatmap está ON para dar contexto preciso por ciudad.
 *
 * Props:
 *   cities      {Array}    – { id, name, latitude, longitude, data }
 *   metrica     {string}   – clave activa ("aqi", "temperatura", etc.)
 *   umbrales    {Array}    – resultado de useUmbrales()
 *   onCityClick {Function} – callback(city)
 *   unidad      {string}   – unidad de medida activa
 *   currentZoom {number}   – nivel de zoom actual del mapa
 */
export default function MarkersLayer({ cities, metrica, umbrales, activeFilter, onCityClick, unidad, currentZoom }) {
  if (!cities?.length || !umbrales.length) return null

  return cities.map(city => {
    const valor    = city.data?.[metrica] ?? 0
    const color    = colorPorValor(umbrales, valor)
    const umbral   = umbralPorValor(umbrales, valor)
    const critico  = ['critica', 'emergencia'].includes(umbral?.severidad)

    const inRange =
      !activeFilter ||
      (umbral?.nivel === activeFilter.nivel)

    if (!inRange) return null;

    const displayValue = convertirValor(metrica, valor, unidad);

    return (
      <Marker
        key={city.id}
        latitude={city.latitude}
        longitude={city.longitude}
        anchor="center"
        onClick={e => {
          e.originalEvent.stopPropagation();
          onCityClick?.(city);
        }}
      >
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div
            className={`city-marker${critico ? ' city-marker--pulse' : ''}`}
            style={{ '--marker-color': color }}
            title={`${city.name}: ${Math.round(displayValue)}`}
          >
            <span className="city-marker__value">{Math.round(displayValue)}</span>
          </div>
          {currentZoom >= 5.5 && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '6px', color: 'white', textShadow: '0px 0px 3px black, 1px 1px 2px black', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600, pointerEvents: 'none' }}>
              {city.name}
            </div>
          )}
        </div>
      </Marker>
    )
  })
}
