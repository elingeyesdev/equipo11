export function addVisibilityLayers(map, customLayer, data) {
  if (!map || !customLayer) return;

  if (data && typeof customLayer.updateData === 'function') {
    customLayer.updateData(data);
  }

  if (!map.getLayer(customLayer.id)) {
    let firstSymbolId = null;
    const layers = map.getStyle().layers;
    for (const layer of layers) {
      if (layer.type === 'symbol' || layer.id.includes('border') || layer.id.includes('admin')) {
        firstSymbolId = layer.id;
        break;
      }
    }
    map.addLayer(customLayer, firstSymbolId);
  }
}

export function removeVisibilityLayers(map) {
  if (!map) return;
  if (map.getLayer('visibility-color-layer')) {
    map.removeLayer('visibility-color-layer');
  }
}
