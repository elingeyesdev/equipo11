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
    const isCustom = !!city.es_custom;

    if (isCustom) {
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
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <div
              className={`city-marker city-marker--custom`}
              style={{
                '--marker-color': color || '#a855f7',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(24, 18, 36, 0.85)',
                border: `2px solid ${color || '#a855f7'}`,
                boxShadow: `0 0 8px ${color || '#a855f7'}`,
              }}
              title={`${city.name}: ${Math.round(displayValue)}`}
            >
              <svg width="18" height="18" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.58 16.14a6 6 0 0 1 6.84 0" />
                <circle cx="12" cy="20" r="1.5" fill="#a855f7" />
              </svg>
            </div>
            <div style={{
              marginTop: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              border: `1px solid ${color || '#a855f7'}`
            }}>
              {Math.round(displayValue)}
            </div>
            {currentZoom >= 5.5 && (
              <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '16px', color: 'white', textShadow: '0px 0px 3px black, 1px 1px 2px black', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 600, pointerEvents: 'none' }}>
                {city.name}
              </div>
            )}
          </div>
        </Marker>
      );
    }

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
