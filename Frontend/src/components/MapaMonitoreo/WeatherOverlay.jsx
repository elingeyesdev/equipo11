import { useEffect, useRef } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';
import GridRadarLayer from '../GridRadarLayer/GridRadarLayer';
import WindColorLayer from '../../layers/windColor/WindColorLayer.js';
import { addWindLayers, removeWindLayers } from '../../layers/windColor/layerManager.js';

/**
 * WeatherOverlay — Orquesta las capas visuales de clima dinámico.
 *
 * Capas gestionadas:
 *  1. WindColorLayer  (WebGL) — mapa de color por velocidad del viento
 *  2. GridRadarLayer  (Canvas) — partículas animadas de lluvia/nieve/viento/etc.
 *  3. Wind labels     (Mapbox symbol) — etiquetas de velocidad del viento
 *
 * Ambas capas (1 y 2) se activan/desactivan con el mismo toggle:
 *   isParticlesActive && particleFilters.wind
 *
 * La inserción inteligente de capas se delega a layerManager.js (SRP),
 * que posiciona el mapa de calor debajo de carreteras, fronteras y etiquetas.
 */
function WeatherOverlay({
  scannedGrid,
  currentZoom,
  particleFilters,
  isParticlesActive,
  dynamicWindLabels
}) {
  const { current: map } = useMap();
  const windLayerRef = useRef(null);
  const dataRef = useRef(null);

  // Guardar referencia a los datos más recientes
  dataRef.current = scannedGrid;

  // --- Ciclo de vida del WindColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;

    // Obtener la instancia nativa de Mapbox GL JS (react-map-gl la envuelve)
    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShow = isParticlesActive && particleFilters.wind;

    const addLayersIfMissing = () => {
      if (!shouldShow) return;

      // Mapbox elimina todas las custom layers cuando el estilo cambia (ej. dark a light)
      // Si la capa ya no existe en el mapa, debemos recrearla.
      if (!rawMap.getLayer('wind-color-layer')) {
        const layer = new WindColorLayer({
          id: 'wind-color-layer',
          opacity: 0.90,
        });
        windLayerRef.current = layer;

        // Delegamos la inserción inteligente a layerManager.js (SRP)
        addWindLayers(rawMap, layer, dataRef.current);
      }
    };

    if (shouldShow) {
      addLayersIfMissing();
      // Si el usuario cambia a Modo Oscuro/Claro, el mapa recarga su estilo y borra nuestra capa
      rawMap.on('styledata', addLayersIfMissing);
    } else {
      removeWindLayers(rawMap);
      windLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addLayersIfMissing);
      // Solo removemos si el componente se desmonta o el estado pasa a oculto
      removeWindLayers(rawMap);
      windLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.wind]);

  // --- Actualizar datos cuando cambia scannedGrid ---
  useEffect(() => {
    if (windLayerRef.current && scannedGrid && scannedGrid.length > 0) {
      windLayerRef.current.updateData(scannedGrid);
    }
  }, [scannedGrid]);

  if (!isParticlesActive) return null;

  return (
    <>
      <GridRadarLayer
        scannedGrid={scannedGrid}
        currentZoom={currentZoom}
        particleFilters={particleFilters}
      />

      {particleFilters.wind && dynamicWindLabels && (
        <Source id="dynamic-wind-source" type="geojson" data={dynamicWindLabels}>
          <Layer
            id="dynamic-wind-text-layer"
            type="symbol"
            layout={{
              'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['round', ['to-number', ['get', 'wind_speed']]]], ' km/h'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-offset': [0, 0.5],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-ignore-placement': false,
              'text-padding': 20
            }}
            paint={{
              'text-color': '#a7f3d0',
              'text-halo-color': '#000000',
              'text-halo-width': 1.5
            }}
          />
        </Source>
      )}
    </>
  );
}

export default WeatherOverlay;
