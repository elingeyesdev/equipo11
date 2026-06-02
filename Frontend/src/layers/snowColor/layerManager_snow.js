export const addSnowLayers = (map, layerInstance, coastlineId, data) => {
  if (data && data.length > 0) {
    layerInstance.updateData(data);
  }

  // Buscar la primera capa de símbolos, fronteras o carreteras para colocar la nieve DEBAJO de ellas
  const firstSymbolId = map.getStyle().layers.find(
    l => l.type === 'symbol' || l.id.includes('admin') || l.id.includes('road')
  )?.id;

  if (!map.getLayer(layerInstance.id)) {
    map.addLayer(layerInstance, firstSymbolId);
  }

  // Capa de costas aislada para nieve
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
};

export const removeSnowLayers = (map, layerId, coastlineId) => {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  try {
    if (map && map.getStyle()) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(coastlineId)) map.removeLayer(coastlineId);
    }
  } catch (err) {
    console.warn('[layerManager_snow] Error removiendo capas de nieve:', err.message);
  }
};
