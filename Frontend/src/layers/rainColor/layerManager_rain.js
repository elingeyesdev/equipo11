/**
 * layerManager_rain.js — Módulo dedicado a la inserción inteligente de la capa de lluvia
 * en el árbol de renderizado de Mapbox GL JS.
 */

/**
 * Encuentra el punto óptimo de inserción para que las capas de datos
 * se rendericen POR DEBAJO de toda la infraestructura humana visible.
 */
export function findOptimalInsertionPoint(map) {
  try {
    const layers = map.getStyle()?.layers;
    if (!layers) return undefined;

    for (const layer of layers) {
      const id = layer.id;
      if (
        id.includes('tunnel') ||
        id.includes('road') ||
        id.includes('bridge') ||
        id.includes('aeroway') ||
        id.includes('rail')
      ) {
        return id;
      }
    }

    for (const layer of layers) {
      if (
        layer.id.includes('admin') ||
        layer.id.includes('boundary') ||
        layer.id.includes('border')
      ) {
        return layer.id;
      }
    }

    for (const layer of layers) {
      if (layer.type === 'symbol') {
        return layer.id;
      }
    }
  } catch (_) { /* ignore */ }
  return undefined;
}

/**
 * Inyecta la capa de lluvia (color) en el mapa.
 *
 * @param {mapboxgl.Map} map
 * @param {Object} rainColorLayer — Capa WebGL personalizada (CustomLayerInterface)
 * @param {Array|null} currentData — Datos del grid actual
 */
export function addRainLayers(map, rainColorLayer, coastlineId, currentData) {
  const insertBefore = findOptimalInsertionPoint(map);

  if (!map.getLayer(rainColorLayer.id)) {
    map.addLayer(rainColorLayer, insertBefore);
  }

  // Capa de costas aislada para lluvia
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

  if (currentData && currentData.length > 0) {
    rainColorLayer.updateData(currentData);
  }
}

/**
 * Remueve la capa de lluvia del mapa de forma segura.
 *
 * @param {mapboxgl.Map} map
 * @param {string} layerId
 * @param {string} coastlineId
 */
export function removeRainLayers(map, layerId, coastlineId) {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(coastlineId)) map.removeLayer(coastlineId);
  } catch (e) {
    console.warn('[layerManager_rain] Error removiendo capas de lluvia:', e.message);
  }
}
