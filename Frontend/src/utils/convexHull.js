/**
 * convexHull.js — Algoritmo Graham Scan para calcular el Convex Hull.
 *
 * Recibe un array de puntos [{lng, lat}] y devuelve el subconjunto
 * de puntos que forman el polígono convexo mínimo que los encierra,
 * ordenados en sentido antihorario.
 *
 * Se usa para generar el área de monitoreo en el modo simulación.
 */

/**
 * Calcula el producto cruzado de tres puntos (p1, p2, p3).
 * Retorna:
 *  > 0 → giro antihorario (left turn)
 *  = 0 → colineales
 *  < 0 → giro horario (right turn)
 */
function cross(O, A, B) {
  return (A.lng - O.lng) * (B.lat - O.lat) - (A.lat - O.lat) * (B.lng - O.lng);
}

/**
 * computeConvexHull — Graham Scan O(n log n).
 *
 * @param {Array<{lng: number, lat: number}>} points
 * @returns {Array<{lng: number, lat: number}>} — puntos del hull en orden antihorario,
 *   incluyendo el primer punto repetido al final para cerrar el polígono.
 *   Retorna [] si hay menos de 3 puntos.
 */
export function computeConvexHull(points) {
  if (!points || points.length < 3) return [];

  // Copiar y ordenar: primero por lat (↑), luego por lng (↑)
  const pts = [...points].sort((a, b) =>
    a.lat !== b.lat ? a.lat - b.lat : a.lng - b.lng
  );

  const n = pts.length;
  const hull = [];

  // Lower hull
  for (let i = 0; i < n; i++) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], pts[i]) <= 0) {
      hull.pop();
    }
    hull.push(pts[i]);
  }

  // Upper hull
  const lowerLen = hull.length + 1;
  for (let i = n - 2; i >= 0; i--) {
    while (hull.length >= lowerLen && cross(hull[hull.length - 2], hull[hull.length - 1], pts[i]) <= 0) {
      hull.pop();
    }
    hull.push(pts[i]);
  }

  // Eliminar el último punto (duplicado del primero)
  hull.pop();

  // Cerrar el polígono repitiendo el primer punto al final (requisito GeoJSON)
  return [...hull, hull[0]];
}

/**
 * hullToGeoJSON — Convierte el hull a un Feature GeoJSON Polygon.
 * Listo para usar directamente en <Source data={...}> de react-map-gl.
 *
 * @param {Array<{lng: number, lat: number}>} hull — resultado de computeConvexHull
 * @returns {GeoJSON.Feature | null}
 */
export function hullToGeoJSON(hull) {
  if (!hull || hull.length < 4) return null; // necesita al menos 3 puntos + cierre

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      // GeoJSON usa [lng, lat]
      coordinates: [hull.map(p => [p.lng, p.lat])],
    },
    properties: {},
  };
}

/**
 * calcAreaKm2 — Calcula el área aproximada del polígono en km²
 * usando la fórmula de Shoelace con conversión esférica simple.
 *
 * @param {Array<{lng: number, lat: number}>} hull
 * @returns {number} área en km²
 */
export function calcAreaKm2(hull) {
  if (!hull || hull.length < 4) return 0;

  // Fórmula de Shoelace en grados²
  let area = 0;
  for (let i = 0; i < hull.length - 1; i++) {
    area += hull[i].lng * hull[i + 1].lat;
    area -= hull[i + 1].lng * hull[i].lat;
  }
  area = Math.abs(area) / 2;

  // Conversión: 1° lat ≈ 111 km, 1° lng ≈ 111 * cos(latMedia) km
  const latMedia = hull.reduce((s, p) => s + p.lat, 0) / hull.length;
  const kmPerDegLat = 111;
  const kmPerDegLng = 111 * Math.cos((latMedia * Math.PI) / 180);

  return area * kmPerDegLat * kmPerDegLng;
}
