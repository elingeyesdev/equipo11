export const addSnowLayers = (map, layerInstance, data) => {
  if (data && data.length > 0) {
    layerInstance.updateData(data);
  }

  // Buscar la primera capa de símbolos, fronteras o carreteras para colocar la nieve DEBAJO de ellas
  const firstSymbolId = map.getStyle().layers.find(
    l => l.type === 'symbol' || l.id.includes('admin') || l.id.includes('road')
  )?.id;

  map.addLayer(layerInstance, firstSymbolId);
};

export const removeSnowLayers = (map) => {
  if (map.getLayer('snow-color-layer')) {
    map.removeLayer('snow-color-layer');
  }
};
