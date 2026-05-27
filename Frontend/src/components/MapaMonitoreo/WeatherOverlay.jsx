import { useEffect, useRef, useMemo, memo } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';
import GridRadarLayer from '../GridRadarLayer/GridRadarLayer';
import WindColorLayer from '../../layers/windColor/WindColorLayer.js';
import {
  addWindLayers, removeWindLayers,
  addCityWindLabels, updateCityWindLabels, removeCityWindLabels
} from '../../layers/windColor/layerManager.js';
import RainColorLayer from '../../layers/rainColor/RainColorLayer.js';
import { addRainLayers, removeRainLayers } from '../../layers/rainColor/layerManager_rain.js';
import SnowColorLayer from '../../layers/snowColor/SnowColorLayer.js';
import { addSnowLayers, removeSnowLayers } from '../../layers/snowColor/layerManager_snow.js';
import VisibilityColorLayer from '../../layers/visibilityColor/VisibilityColorLayer.js';
import { addVisibilityLayers, removeVisibilityLayers } from '../../layers/visibilityColor/layerManager_visibility.js';
import { useMapVisuals } from '../../context/MapVisualsContext.jsx';
import { GLOBAL_CITIES } from '../../utils/globalCities.js';
import { buildGridIndex, buildCitiesWindGeoJSON } from '../../utils/windMath.js';

/**
 * WeatherOverlay — Orquesta las capas visuales de clima dinámico.
 *
 * Capas gestionadas:
 *  1. WindColorLayer       (WebGL)  — mapa de color por velocidad del viento
 *  2. GridRadarLayer       (Canvas) — partículas animadas de lluvia/nieve/viento/etc.
 *  3. City wind labels     (Symbol) — etiquetas globales de velocidad por ciudad
 *  4. Dynamic wind labels  (Symbol) — etiquetas dinámicas de sensores IoT
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
  const { snowMapType } = useMapVisuals();
  const { current: map } = useMap();
  const windLayerRef = useRef(null);
  const rainLayerRef = useRef(null);
  const snowLayerRef = useRef(null);
  const visLayerRef = useRef(null);
  const dataRef = useRef(null);

  // --- 1. Proteger el Payload Masivo (Ahogo del Virtual DOM) ---
  // Memoizamos el arreglo de 64,800 nodos para evitar que React y DevTools
  // lo clonen o lo re-evalúen constantemente en renders no relacionados (ej. al cambiar zoom).
  const protectedGrid = useMemo(() => scannedGrid, [scannedGrid]);

  // Guardar referencia a los datos más recientes
  dataRef.current = protectedGrid;

  // --- Precalcular el índice vectorial del grid (U,V) para interpolación ---
  // Solo se recalcula cuando cambian los datos de la NOAA
  const gridIndex = useMemo(() => {
    if (!protectedGrid || protectedGrid.length === 0) return null;
    return buildGridIndex(protectedGrid);
  }, [protectedGrid]);

  // --- Generar GeoJSON de ciudades con viento interpolado vectorialmente ---
  const citiesWindGeoJSON = useMemo(() => {
    if (!gridIndex || gridIndex.size === 0) return null;
    return buildCitiesWindGeoJSON(GLOBAL_CITIES, gridIndex);
  }, [gridIndex]);

  // --- Ciclo de vida del WindColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;

    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShow = isParticlesActive && particleFilters.wind;

    const addLayersIfMissing = () => {
      if (!shouldShow) return;

      // Mapbox elimina todas las custom layers cuando el estilo cambia (ej. dark a light)
      if (!rawMap.getLayer('wind-color-layer')) {
        const layer = new WindColorLayer({
          id: 'wind-color-layer',
          opacity: 0.90,
        });
        windLayerRef.current = layer;
        addWindLayers(rawMap, layer, dataRef.current);
      }

      // Inyectar etiquetas de ciudades globales si hay datos
      if (citiesWindGeoJSON) {
        if (!rawMap.getSource('global-wind-cities-source')) {
          addCityWindLabels(rawMap, citiesWindGeoJSON);
        }
      }
    };

    if (shouldShow) {
      addLayersIfMissing();
      rawMap.on('styledata', addLayersIfMissing);
    } else {
      removeWindLayers(rawMap);
      windLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addLayersIfMissing);
      removeWindLayers(rawMap);
      if (windLayerRef.current && typeof windLayerRef.current.destroy === 'function') {
        windLayerRef.current.destroy(); // Limpieza forzada de GPU
      }
      windLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.wind, citiesWindGeoJSON]);

  // --- Actualizar datos cuando cambia protectedGrid ---
  useEffect(() => {
    if (windLayerRef.current && protectedGrid && protectedGrid.length > 0) {
      windLayerRef.current.updateData(protectedGrid);
    }
    if (rainLayerRef.current && protectedGrid && protectedGrid.length > 0) {
      rainLayerRef.current.updateData(protectedGrid);
    }
    if (snowLayerRef.current && protectedGrid && protectedGrid.length > 0) {
      snowLayerRef.current.updateData(protectedGrid);
    }
    if (visLayerRef.current && protectedGrid && protectedGrid.length > 0) {
      visLayerRef.current.updateData(protectedGrid);
    }
  }, [protectedGrid]);

  // --- Ciclo de vida del RainColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;

    const rawMap = map.getMap();
    if (!rawMap) return;

    // Asumimos que la llave del filtro es 'rain'
    const shouldShowRain = isParticlesActive && particleFilters.rain;

    const addRainIfMissing = () => {
      if (!shouldShowRain) return;

      if (!rawMap.getLayer('rain-color-layer')) {
        const layer = new RainColorLayer({
          id: 'rain-color-layer',
          opacity: 0.85,
        });
        rainLayerRef.current = layer;
        addRainLayers(rawMap, layer, dataRef.current);
      }
    };

    if (shouldShowRain) {
      addRainIfMissing();
      rawMap.on('styledata', addRainIfMissing);
    } else {
      removeRainLayers(rawMap);
      rainLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addRainIfMissing);
      removeRainLayers(rawMap);
      if (rainLayerRef.current && typeof rainLayerRef.current.destroy === 'function') {
        rainLayerRef.current.destroy(); // Limpieza estricta de texturas WebGL
      }
      rainLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.rain]);

  // --- Ciclo de vida del SnowColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;

    const rawMap = map.getMap();
    if (!rawMap) return;

    // Asumimos que la llave del filtro es 'snow'
    const shouldShowSnow = isParticlesActive && particleFilters.snow;

    const addSnowIfMissing = () => {
      if (!shouldShowSnow) return;

      if (!rawMap.getLayer('snow-color-layer')) {
        const layer = new SnowColorLayer({
          id: 'snow-color-layer',
          opacity: 0.85,
          snowType: snowMapType === 'fresh' ? 1 : 0
        });
        snowLayerRef.current = layer;
        addSnowLayers(rawMap, layer, dataRef.current);
      } else if (snowLayerRef.current) {
        snowLayerRef.current.setSnowType(snowMapType === 'fresh' ? 1 : 0);
      }
    };

    if (shouldShowSnow) {
      addSnowIfMissing();
      rawMap.on('styledata', addSnowIfMissing);
    } else {
      removeSnowLayers(rawMap);
      snowLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addSnowIfMissing);
      removeSnowLayers(rawMap);
      if (snowLayerRef.current && typeof snowLayerRef.current.destroy === 'function') {
        snowLayerRef.current.destroy(); // Limpieza estricta de texturas WebGL
      }
      snowLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.snow, snowMapType]);

  // --- Ciclo de vida del VisibilityColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;

    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShowVis = isParticlesActive && particleFilters.fog;

    const addVisIfMissing = () => {
      if (!shouldShowVis) return;

      if (!rawMap.getLayer('visibility-color-layer')) {
        const layer = new VisibilityColorLayer({
          id: 'visibility-color-layer',
          opacity: 0.85,
        });
        visLayerRef.current = layer;
        addVisibilityLayers(rawMap, layer, dataRef.current);
      }
    };

    if (shouldShowVis) {
      addVisIfMissing();
      rawMap.on('styledata', addVisIfMissing);
    } else {
      removeVisibilityLayers(rawMap);
      visLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addVisIfMissing);
      removeVisibilityLayers(rawMap);
      if (visLayerRef.current && typeof visLayerRef.current.destroy === 'function') {
        visLayerRef.current.destroy();
      }
      visLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.fog]);

  // --- Actualizar GeoJSON de ciudades cuando cambian los datos ---
  useEffect(() => {
    if (!map || !citiesWindGeoJSON) return;
    const rawMap = map.getMap();
    if (!rawMap) return;

    updateCityWindLabels(rawMap, citiesWindGeoJSON);
  }, [map, citiesWindGeoJSON]);

  if (!isParticlesActive) return null;

  return (
    <>
      <GridRadarLayer
        scannedGrid={protectedGrid}
        currentZoom={currentZoom}
        particleFilters={{ ...particleFilters, fog: false }}
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

export default memo(WeatherOverlay);
