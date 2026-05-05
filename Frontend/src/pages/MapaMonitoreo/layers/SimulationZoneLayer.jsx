/**
 * SimulationZoneLayer — Renderiza el área de simulación como polígono GeoJSON.
 *
 * Capas usadas:
 *  - sim-zone-fill   → relleno semitransparente azul cyan
 *  - sim-zone-line   → contorno sólido
 *  - sim-zone-glow   → glow exterior (línea más gruesa, muy transparente)
 */
import { useEffect, useRef } from 'react';
import { Source, Layer } from 'react-map-gl/mapbox';

const FILL_LAYER = {
  id: 'sim-zone-fill',
  type: 'fill',
  paint: {
    'fill-color': '#38bdf8',
    'fill-opacity': 0.12,
  },
};

const LINE_LAYER = {
  id: 'sim-zone-line',
  type: 'line',
  paint: {
    'line-color': '#38bdf8',
    'line-width': 2,
    'line-opacity': 0.9,
    'line-dasharray': [1, 0],
  },
};

const GLOW_LAYER = {
  id: 'sim-zone-glow',
  type: 'line',
  paint: {
    'line-color': '#38bdf8',
    'line-width': 8,
    'line-opacity': 0.15,
    'line-blur': 4,
  },
};

/**
 * @param {{ geojson: GeoJSON.Feature }} props
 */
export default function SimulationZoneLayer({ geojson }) {
  if (!geojson) return null;

  return (
    <Source id="sim-zone-source" type="geojson" data={geojson}>
      <Layer {...GLOW_LAYER} />
      <Layer {...FILL_LAYER} />
      <Layer {...LINE_LAYER} />
    </Source>
  );
}
