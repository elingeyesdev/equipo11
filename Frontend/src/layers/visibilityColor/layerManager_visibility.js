export function addVisibilityLayers(map, customLayer, data) {
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
  if (!map.getLayer('custom-coastline-vis')) {
    map.addLayer({
      id: 'custom-coastline-vis',
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

export function removeVisibilityLayers(map) {
  if (!map) return;
  if (map.getLayer('visibility-color-layer')) {
    map.removeLayer('visibility-color-layer');
  }
  if (map.getLayer('custom-coastline-vis')) {
    map.removeLayer('custom-coastline-vis');
  }
}
