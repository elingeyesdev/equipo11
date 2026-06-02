import { findOptimalInsertionPoint } from '../windColor/layerManager.js';

export function addAqiLayers(map, aqiColorLayer, coastlineId) {
  const insertBefore = findOptimalInsertionPoint(map);

  if (!map.getLayer(aqiColorLayer.id)) {
    map.addLayer(aqiColorLayer, insertBefore);
  }

  // Capa de costas exclusiva para AQI
  if (!map.getLayer(coastlineId)) {
    map.addLayer({
      id: coastlineId,
      type: 'line',
      source: 'composite',
      'source-layer': 'water',
      paint: {
        'line-color': 'rgba(0, 0, 0, 0.4)',
        'line-width': 1.5,
      }
    }, insertBefore);
  }
}

export function removeAqiLayers(map, layerId, coastlineId) {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  if (!map) return;
  try {
    if (map.getStyle()) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(coastlineId)) map.removeLayer(coastlineId);
    }
  } catch (e) {
    console.warn('[layerManager_aqi] Error removiendo capas:', e.message);
  }
}
