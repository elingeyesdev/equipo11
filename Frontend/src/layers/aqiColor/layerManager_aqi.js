import { findOptimalInsertionPoint } from '../windColor/layerManager.js';

export function addAqiLayers(map, aqiColorLayer) {
  const insertBefore = findOptimalInsertionPoint(map);

  map.addLayer(aqiColorLayer, insertBefore);

  // Capa de costas exclusiva para AQI
  if (!map.getLayer('custom-coastline-aqi')) {
    map.addLayer({
      id: 'custom-coastline-aqi',
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

export function removeAqiLayers(map) {
  if (!map) return;
  try {
    if (map.getStyle()) {
      if (map.getLayer('aqi-color-layer')) map.removeLayer('aqi-color-layer');
      if (map.getLayer('custom-coastline-aqi')) map.removeLayer('custom-coastline-aqi');
    }
  } catch (e) {
    console.warn('[layerManager_aqi] Error removiendo capas:', e.message);
  }
}
