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
export function addWindLayers(map, windColorLayer, coastlineId, currentData) {
  const insertBefore = findOptimalInsertionPoint(map);

  if (!map.getLayer(windColorLayer.id)) {
    map.addLayer(windColorLayer, insertBefore);
  }

  // Capa de costas (fronteras hacia el mar)
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

  // Subir datos si ya existen
  if (currentData && currentData.length > 0) {
    windColorLayer.updateData(currentData);
  }
}

/**
 * Remueve las capas de viento del mapa de forma segura.
 */
export function removeWindLayers(map, layerId, coastlineId, sourceId, labelLayerId) {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(coastlineId)) map.removeLayer(coastlineId);
    removeCityWindLabels(map, sourceId, labelLayerId);
  } catch (e) {
    console.warn('[layerManager] Error removiendo capas:', e.message);
  }
}

// ─── Capa de Etiquetas de Viento en Ciudades Globales ─────────────────────

/**
 * Inyecta la capa de símbolos de texto para ciudades globales.
 */
export function addCityWindLabels(map, geojson, sourceId, labelLayerId) {
  try {
    if (map.getSource(sourceId)) return; // Ya existe

    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
    });

    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': [
          'concat',
          ['get', 'name'], '\n',
          ['to-string', ['round', ['to-number', ['get', 'wind_speed']]]],
          ' km/h'
        ],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          2, 10,
          5, 12,
          8, 14,
        ],
        'text-offset': [0, 0],
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-padding': 8,
        'text-optional': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.85)',
        'text-halo-width': 1.8,
        'text-halo-blur': 0.5,
      },
    });
  } catch (e) {
    console.warn('[layerManager] Error añadiendo etiquetas de ciudades:', e.message);
  }
}

/**
 * Actualiza los datos GeoJSON de la capa de ciudades sin destruirla/recrearla.
 */
export function updateCityWindLabels(map, geojson, sourceId) {
  try {
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(geojson);
    }
  } catch (e) {
    console.warn('[layerManager] Error actualizando etiquetas:', e.message);
  }
}

/**
 * Remueve la capa y fuente de etiquetas de ciudades.
 */
export function removeCityWindLabels(map, sourceId, labelLayerId) {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  try {
    if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch (_) { /* ignore */ }
}
