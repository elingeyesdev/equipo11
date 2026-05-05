/**
 * SimulationZoneLayer — Renderiza el área de simulación como polígono GeoJSON.
 *
 * Cuando la simulación de zona está activa, el color cambia dinámicamente
 * según el valor del último tick (pasado como prop `color`).
 * Sin simulación activa → color cyan estático (modo edición).
 */
import { Source, Layer } from 'react-map-gl/mapbox';

const EDIT_COLOR = '#38bdf8';  // cyan estático (modo edición)

/**
 * @param {{
 *   geojson: GeoJSON.Feature,
 *   color?: string,          // color hex activo (del umbral del tick actual)
 *   simActiva?: boolean,     // true = simulación en marcha
 * }} props
 */
export default function SimulationZoneLayer({ geojson, color, simActiva = false }) {
  if (!geojson) return null;

  const activeColor = simActiva && color ? color : EDIT_COLOR;
  const fillOpacity = simActiva ? 0.22 : 0.12;
  const lineWidth   = simActiva ? 2.5  : 2;
  const glowWidth   = simActiva ? 12   : 8;
  const glowOpacity = simActiva ? 0.20 : 0.15;

  const FILL_LAYER = {
    id: 'sim-zone-fill',
    type: 'fill',
    paint: {
      'fill-color': activeColor,
      'fill-opacity': fillOpacity,
    },
  };

  const LINE_LAYER = {
    id: 'sim-zone-line',
    type: 'line',
    paint: {
      'line-color': activeColor,
      'line-width': lineWidth,
      'line-opacity': 0.9,
    },
  };

  const GLOW_LAYER = {
    id: 'sim-zone-glow',
    type: 'line',
    paint: {
      'line-color': activeColor,
      'line-width': glowWidth,
      'line-opacity': glowOpacity,
      'line-blur': 6,
    },
  };

  return (
    <Source id="sim-zone-source" type="geojson" data={geojson}>
      <Layer {...GLOW_LAYER} />
      <Layer {...FILL_LAYER} />
      <Layer {...LINE_LAYER} />
    </Source>
  );
}
