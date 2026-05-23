/**
 * layerManager.js — Módulo dedicado a la inserción inteligente de capas
 * en el árbol de renderizado de Mapbox GL JS.
 *
 * SRP: Solo se ocupa de encontrar puntos de inserción y gestionar
 * la adición/remoción de capas meteorológicas.
 */

/**
 * Encuentra el punto óptimo de inserción para que las capas de datos
 * se rendericen POR DEBAJO de toda la infraestructura humana visible.
 *
 * Prioridad de búsqueda (más bajo → más alto en el stack visual):
 *  1. Túneles y carreteras (tunnel-*, road-*, bridge-*)
 *  2. Fronteras administrativas (admin-*, boundary-*, border-*)
 *  3. Etiquetas y símbolos (type === 'symbol')
 *
 * @param {mapboxgl.Map} map — Instancia nativa de Mapbox GL JS
 * @returns {string|undefined} — ID de la capa antes de la cual insertar
 */
export function findOptimalInsertionPoint(map) {
  try {
    const layers = map.getStyle()?.layers;
    if (!layers) return undefined;

    // Buscar la primera capa de infraestructura terrestre
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

    // Fallback: buscar fronteras administrativas
    for (const layer of layers) {
      if (
        layer.id.includes('admin') ||
        layer.id.includes('boundary') ||
        layer.id.includes('border')
      ) {
        return layer.id;
      }
    }

    // Último fallback: insertar debajo de la primera capa de tipo 'symbol'
    for (const layer of layers) {
      if (layer.type === 'symbol') {
        return layer.id;
      }
    }
  } catch (_) { /* ignore */ }
  return undefined;
}

/**
 * Inyecta las capas de viento (color + costas) en el mapa.
 *
 * @param {mapboxgl.Map} map
 * @param {Object} windColorLayer — Capa WebGL personalizada (CustomLayerInterface)
 * @param {Array|null} currentData — Datos del grid actual
 */
export function addWindLayers(map, windColorLayer, currentData) {
  const insertBefore = findOptimalInsertionPoint(map);

  map.addLayer(windColorLayer, insertBefore);

  // Capa de costas (fronteras hacia el mar)
  if (!map.getLayer('custom-coastline')) {
    map.addLayer({
      id: 'custom-coastline',
      type: 'line',
      source: 'composite',
      'source-layer': 'water',
      paint: {
        'line-color': 'rgba(0, 0, 0, 0.4)',
        'line-width': 1.5,
      }
    }, insertBefore);
  }

  // Subir datos si ya existen
  if (currentData && currentData.length > 0) {
    windColorLayer.updateData(currentData);
  }
}

/**
 * Remueve las capas de viento del mapa de forma segura.
 *
 * @param {mapboxgl.Map} map
 */
export function removeWindLayers(map) {
  try {
    if (map.getLayer('wind-color-layer')) map.removeLayer('wind-color-layer');
    if (map.getLayer('custom-coastline')) map.removeLayer('custom-coastline');
  } catch (e) {
    console.warn('[layerManager] Error removiendo capas:', e.message);
  }
}
