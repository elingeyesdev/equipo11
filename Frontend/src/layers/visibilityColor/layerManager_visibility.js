export function addVisibilityLayers(map, customLayer, coastlineId, data) {
  if (!map || !customLayer) return;

  let firstSymbolId = null;
  const layers = map.getStyle().layers;
  for (const layer of layers) {
    if (layer.type === 'symbol' || layer.id.includes('border') || layer.id.includes('admin')) {
      firstSymbolId = layer.id;
      break;
    }
  }

  if (!map.getLayer(customLayer.id)) {
    map.addLayer(customLayer, firstSymbolId);
  }

  // Capa de costas aislada para visibilidad
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
    }, firstSymbolId);
  }

  if (data && typeof customLayer.updateData === 'function') {
    customLayer.updateData(data);
  }
}

export function removeVisibilityLayers(map, layerId, coastlineId) {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  if (!map) return;
  try {
    if (map.getStyle() && map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  } catch (err) {
    console.warn('[layerManager_visibility] Error removiendo capa de neblina:', err.message);
  }
  if (map.getLayer(coastlineId)) {
    map.removeLayer(coastlineId);
  }
}
