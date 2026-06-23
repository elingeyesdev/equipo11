import { useEffect, useRef, memo } from 'react';
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
import TempColorLayer, { addTempLayers, removeTempLayers, addCityTempLabels, updateCityTempLabels, removeCityTempLabels } from '../../layers/tempColor/TempColorLayer.js';
import AqiColorLayer from '../../layers/aqiColor/AqiColorLayer.js';
import { addAqiLayers, removeAqiLayers } from '../../layers/aqiColor/layerManager_aqi.js';
import { useMapVisuals } from '../../context/MapVisualsContext.jsx';
import { useUnidades } from '../../hooks/useUnidades';

/**
 * WeatherOverlay — Orquesta las capas visuales de clima dinámico.
 *
 * ARQUITECTURA DATA TEXTURE PNG:
 * scannedGrid ahora es un objeto de HTMLImageElements:
 *   { tempImg, visImg, rainImg, snowImg, windImg, aqiImg }
 * Cada imagen se inyecta directamente en la GPU vía gl.texImage2D(gl.RGBA).
 * Ya no existe transporte JSON masivo.
 */
function WeatherOverlay({
  idPrefix = 'global',
  scannedGrid,
  currentZoom,
  particleFilters,
  isParticlesActive,
  dynamicWindLabels
}) {
  const { snowMapType } = useMapVisuals();
  const { unidades } = useUnidades();
  const activeTempUnit = unidades['temperatura'] || 'C';
  const { current: map } = useMap();
  const windLayerRef = useRef(null);
  const rainLayerRef = useRef(null);
  const snowLayerRef = useRef(null);
  const visLayerRef = useRef(null);
  const tempLayerRef = useRef(null);
  const aqiLayerRef = useRef(null);

  const windLayerId = `wind-color-layer-${idPrefix}`;
  const windCoastlineId = `custom-coastline-wind-${idPrefix}`;
  const windLabelSourceId = `global-wind-cities-source-${idPrefix}`;
  const windLabelLayerId = `global-wind-cities-label-${idPrefix}`;

  const rainLayerId = `rain-color-layer-${idPrefix}`;
  const rainCoastlineId = `custom-coastline-rain-${idPrefix}`;

  const snowLayerId = `snow-color-layer-${idPrefix}`;
  const snowCoastlineId = `custom-coastline-snow-${idPrefix}`;

  const visLayerId = `visibility-color-layer-${idPrefix}`;
  const visCoastlineId = `custom-coastline-vis-${idPrefix}`;

  const tempLayerId = `temp-color-layer-${idPrefix}`;
  const tempCoastlineId = `custom-coastline-temp-${idPrefix}`;
  const tempLabelSourceId = `city-temp-source-${idPrefix}`;
  const tempLabelLayerId = `city-temp-labels-${idPrefix}`;

  const aqiLayerId = `aqi-color-layer-${idPrefix}`;
  const aqiCoastlineId = `custom-coastline-aqi-${idPrefix}`;

  // --- Actualizar texturas cuando cambian las imágenes PNG ---
  useEffect(() => {
    if (!scannedGrid) return;

    if (windLayerRef.current && scannedGrid.windImg) {
      windLayerRef.current.updateData(scannedGrid.windImg);
    }
    if (rainLayerRef.current && scannedGrid.rainImg) {
      rainLayerRef.current.updateData(scannedGrid.rainImg);
    }
    if (snowLayerRef.current && scannedGrid.snowImg) {
      snowLayerRef.current.updateData(scannedGrid.snowImg);
    }
    if (visLayerRef.current && scannedGrid.visImg) {
      visLayerRef.current.updateData(scannedGrid.visImg);
    }
    if (tempLayerRef.current && scannedGrid.tempImg) {
      tempLayerRef.current.updateData(scannedGrid.tempImg);
    }
    if (aqiLayerRef.current && scannedGrid.aqiImg) {
      aqiLayerRef.current.updateData(scannedGrid.aqiImg);
    }
  }, [scannedGrid]);

  // --- Escuchar updates a 60fps del TimePlayer (Crossfading) ---
  useEffect(() => {
    const handleTimeUpdate = (e) => {
      const {
        currentTempImg, nextTempImg,
        currentVisImg, nextVisImg,
        currentRainImg, nextRainImg,
        currentSnowImg, nextSnowImg,
        currentWindImg, nextWindImg,
        currentAqiImg, nextAqiImg,
        mixFactor
      } = e.detail;



      if (tempLayerRef.current && typeof tempLayerRef.current.updateDataDual === 'function' && currentTempImg) {
        tempLayerRef.current.updateDataDual(currentTempImg, nextTempImg || currentTempImg, mixFactor);
      }
      if (visLayerRef.current && typeof visLayerRef.current.updateDataDual === 'function' && currentVisImg) {
        visLayerRef.current.updateDataDual(currentVisImg, nextVisImg || currentVisImg, mixFactor);
      }
      if (rainLayerRef.current && typeof rainLayerRef.current.updateDataDual === 'function' && currentRainImg) {
        rainLayerRef.current.updateDataDual(currentRainImg, nextRainImg || currentRainImg, mixFactor);
      }
      if (snowLayerRef.current && typeof snowLayerRef.current.updateDataDual === 'function' && currentSnowImg) {
        snowLayerRef.current.updateDataDual(currentSnowImg, nextSnowImg || currentSnowImg, mixFactor);
      }
      if (windLayerRef.current && typeof windLayerRef.current.updateDataDual === 'function' && currentWindImg) {
        windLayerRef.current.updateDataDual(currentWindImg, nextWindImg || currentWindImg, mixFactor);
      }
      if (aqiLayerRef.current && typeof aqiLayerRef.current.updateDataDual === 'function' && currentAqiImg) {
        aqiLayerRef.current.updateDataDual(currentAqiImg, nextAqiImg || currentAqiImg, mixFactor);
      }

      if (map) {
        const rawMap = typeof map.getMap === 'function' ? map.getMap() : map;
        if (rawMap && typeof rawMap.triggerRepaint === 'function') {
          rawMap.triggerRepaint();
        }
      }
    };
    window.addEventListener('timeplayer-update', handleTimeUpdate);
    return () => window.removeEventListener('timeplayer-update', handleTimeUpdate);
  }, [map]);

  // --- Ciclo de vida del WindColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;
    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShow = isParticlesActive && particleFilters.wind;

    const addLayersIfMissing = () => {
      if (!shouldShow) return;
      const _add = () => {
        if (!rawMap.getLayer(windLayerId)) {
          const layer = new WindColorLayer({ id: windLayerId, opacity: 0.90 });
          windLayerRef.current = layer;
          addWindLayers(rawMap, layer, windCoastlineId);
          // Anti-FOUC: inyectar textura si ya está disponible
          if (scannedGrid?.windImg) layer.updateData(scannedGrid.windImg);
        }
      };
      if (!rawMap.isStyleLoaded()) { rawMap.once('style.load', _add); } else { _add(); }
    };

    if (shouldShow) {
      addLayersIfMissing();
      rawMap.on('styledata', addLayersIfMissing);
    } else {
      removeWindLayers(rawMap, windLayerId, windCoastlineId, windLabelSourceId, windLabelLayerId);
      windLayerRef.current?.destroy?.();
      windLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addLayersIfMissing);
      removeWindLayers(rawMap, windLayerId, windCoastlineId, windLabelSourceId, windLabelLayerId);
      if (windLayerRef.current && typeof windLayerRef.current.destroy === 'function') {
        windLayerRef.current.destroy();
      }
      windLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.wind]);

  // --- Ciclo de vida del RainColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;
    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShowRain = isParticlesActive && particleFilters.rain;

    const addRainIfMissing = () => {
      if (!shouldShowRain) return;
      const _add = () => {
        if (!rawMap.getLayer(rainLayerId)) {
          const layer = new RainColorLayer({ id: rainLayerId, opacity: 0.85 });
          rainLayerRef.current = layer;
          addRainLayers(rawMap, layer, rainCoastlineId);
          if (scannedGrid?.rainImg) layer.updateData(scannedGrid.rainImg);
        }
      };
      if (!rawMap.isStyleLoaded()) { rawMap.once('style.load', _add); } else { _add(); }
    };

    if (shouldShowRain) {
      addRainIfMissing();
      rawMap.on('styledata', addRainIfMissing);
    } else {
      removeRainLayers(rawMap, rainLayerId, rainCoastlineId);
      rainLayerRef.current?.destroy?.();
      rainLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addRainIfMissing);
      removeRainLayers(rawMap, rainLayerId, rainCoastlineId);
      if (rainLayerRef.current && typeof rainLayerRef.current.destroy === 'function') {
        rainLayerRef.current.destroy();
      }
      rainLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.rain]);

  // --- Ciclo de vida del SnowColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;
    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShowSnow = isParticlesActive && particleFilters.snow;

    const addSnowIfMissing = () => {
      if (!shouldShowSnow) return;
      const _add = () => {
        if (!rawMap.getLayer(snowLayerId)) {
          const layer = new SnowColorLayer({
            id: snowLayerId, opacity: 0.85,
            snowType: snowMapType === 'fresh' ? 1 : 0
          });
          snowLayerRef.current = layer;
          addSnowLayers(rawMap, layer, snowCoastlineId);
          if (scannedGrid?.snowImg) layer.updateData(scannedGrid.snowImg);
        } else if (snowLayerRef.current) {
          snowLayerRef.current.setSnowType(snowMapType === 'fresh' ? 1 : 0);
        }
      };
      if (!rawMap.isStyleLoaded()) { rawMap.once('style.load', _add); } else { _add(); }
    };

    if (shouldShowSnow) {
      addSnowIfMissing();
      rawMap.on('styledata', addSnowIfMissing);
    } else {
      removeSnowLayers(rawMap, snowLayerId, snowCoastlineId);
      snowLayerRef.current?.destroy?.();
      snowLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addSnowIfMissing);
      removeSnowLayers(rawMap, snowLayerId, snowCoastlineId);
      if (snowLayerRef.current && typeof snowLayerRef.current.destroy === 'function') {
        snowLayerRef.current.destroy();
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
      const _add = () => {
        if (!rawMap.getLayer(visLayerId)) {
          const layer = new VisibilityColorLayer({ id: visLayerId, opacity: 0.85 });
          visLayerRef.current = layer;
          addVisibilityLayers(rawMap, layer, visCoastlineId);
          if (scannedGrid?.visImg) layer.updateData(scannedGrid.visImg);
        }
      };
      if (!rawMap.isStyleLoaded()) { rawMap.once('style.load', _add); } else { _add(); }
    };

    if (shouldShowVis) {
      addVisIfMissing();
      rawMap.on('styledata', addVisIfMissing);
    } else {
      removeVisibilityLayers(rawMap, visLayerId, visCoastlineId);
      visLayerRef.current?.destroy?.();
      visLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addVisIfMissing);
      removeVisibilityLayers(rawMap, visLayerId, visCoastlineId);
      if (visLayerRef.current && typeof visLayerRef.current.destroy === 'function') {
        visLayerRef.current.destroy();
      }
      visLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.fog]);

  // --- Ciclo de vida del TempColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;
    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShowTemp = isParticlesActive && particleFilters.temp;

    const addTempIfMissing = () => {
      if (!shouldShowTemp) return;
      const _add = () => {
        if (!rawMap.getLayer(tempLayerId)) {
          const layer = new TempColorLayer({ id: tempLayerId, opacity: 0.90 });
          tempLayerRef.current = layer;
          addTempLayers(rawMap, layer, tempCoastlineId);
          if (scannedGrid?.tempImg) layer.updateData(scannedGrid.tempImg);
        }
      };
      if (!rawMap.isStyleLoaded()) { rawMap.once('style.load', _add); } else { _add(); }
    };

    if (shouldShowTemp) {
      addTempIfMissing();
      rawMap.on('styledata', addTempIfMissing);
    } else {
      removeTempLayers(rawMap, tempLayerId, tempCoastlineId, tempLabelSourceId, tempLabelLayerId);
      tempLayerRef.current?.destroy?.();
      tempLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addTempIfMissing);
      removeTempLayers(rawMap, tempLayerId, tempCoastlineId, tempLabelSourceId, tempLabelLayerId);
      if (tempLayerRef.current && typeof tempLayerRef.current.destroy === 'function') {
        tempLayerRef.current.destroy();
      }
      tempLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.temp]);

  // --- Ciclo de vida del AqiColorLayer (WebGL) ---
  useEffect(() => {
    if (!map) return;
    const rawMap = map.getMap();
    if (!rawMap) return;

    const shouldShowAqi = isParticlesActive && particleFilters.aqi;

    const addAqiIfMissing = () => {
      if (!shouldShowAqi) return;
      const _add = () => {
        if (!rawMap.getLayer(aqiLayerId)) {
          const layer = new AqiColorLayer({ id: aqiLayerId, opacity: 0.90 });
          aqiLayerRef.current = layer;
          addAqiLayers(rawMap, layer, aqiCoastlineId);
          if (scannedGrid?.aqiImg) layer.updateData(scannedGrid.aqiImg);
        }
      };
      if (!rawMap.isStyleLoaded()) { rawMap.once('style.load', _add); } else { _add(); }
    };

    if (shouldShowAqi) {
      addAqiIfMissing();
      rawMap.on('styledata', addAqiIfMissing);
    } else {
      removeAqiLayers(rawMap, aqiLayerId, aqiCoastlineId);
      aqiLayerRef.current?.destroy?.();
      aqiLayerRef.current = null;
    }

    return () => {
      rawMap.off('styledata', addAqiIfMissing);
      removeAqiLayers(rawMap, aqiLayerId, aqiCoastlineId);
      if (aqiLayerRef.current && typeof aqiLayerRef.current.destroy === 'function') {
        aqiLayerRef.current.destroy();
      }
      aqiLayerRef.current = null;
    };
  }, [map, isParticlesActive, particleFilters.aqi]);

  if (!isParticlesActive) return null;

  return (
    <>
      {/* GridRadarLayer ahora recibe las imágenes PNG decodificadas */}
      <GridRadarLayer
        scannedGrid={scannedGrid}
        currentZoom={currentZoom}
        particleFilters={particleFilters} 
      />

      {particleFilters.wind && dynamicWindLabels && (() => {
        const activeWindUnit = unidades['windSpeed'] || 'km/h';
        let windSpeedExpr = ['to-number', ['get', 'wind_speed']];
        if (activeWindUnit === 'm/s') {
          windSpeedExpr = ['/', windSpeedExpr, 3.6];
        } else if (activeWindUnit === 'mph') {
          windSpeedExpr = ['/', windSpeedExpr, 1.60934];
        }
        const windTextFieldExpr = [
          'concat',
          ['get', 'name'],
          '\n',
          ['to-string', ['round', windSpeedExpr]],
          ` ${activeWindUnit}`
        ];
        return (
          <Source id={windLabelSourceId} type="geojson" data={dynamicWindLabels}>
            <Layer
              id={windLabelLayerId}
              type="symbol"
              layout={{
                'text-field': windTextFieldExpr,
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
        );
      })()}


    </>
  );
}

export default memo(WeatherOverlay);
