/**
 * windMath.js — Servicio matemático puro para interpolación vectorial del viento.
 *
 * SRP: Solo contiene funciones matemáticas. No toca DOM, React ni WebGL.
 *
 * Principio clave: Para campos vectoriales, NUNCA se interpola la magnitud
 * directamente. Se descomponen speed+direction → U,V, se interpolan los
 * componentes por separado, y luego se recompone sqrt(u² + v²).
 *
 * Convención meteorológica:
 *   wind_direction = dirección DESDE la cual sopla (0° = Norte, 90° = Este)
 *   U = componente zonal (positivo = viento del Oeste → Este)
 *   V = componente meridional (positivo = viento del Sur → Norte)
 *
 * Coordenadas del Grid (Backend):
 *   - El backend genera centros a intervalos de 1° con offset de +0.5
 *   - latitud:  -89.5, -88.5, ..., 88.5, 89.5  (180 filas)
 *   - longitud: -179.5, -178.5, ..., 178.5, 179.5  (360 columnas)
 *   - Indexación: row = round(lat + 89.5), col = round(lon + 179.5)
 */

const DEG_TO_RAD = Math.PI / 180;
const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;

/**
 * Convierte velocidad y dirección meteorológica a componentes U,V.
 * La dirección meteorológica es "de dónde viene", así que se invierte (+180°).
 *
 * @param {number} speed — Velocidad del viento (km/h)
 * @param {number} dirDeg — Dirección meteorológica en grados (0-360)
 * @returns {{ u: number, v: number }}
 */
function speedDirToUV(speed, dirDeg) {
  if (!isFinite(speed) || !isFinite(dirDeg)) return { u: 0, v: 0 };
  const rad = (dirDeg + 180) * DEG_TO_RAD;
  return {
    u: speed * Math.sin(rad),
    v: speed * Math.cos(rad),
  };
}

/**
 * Construye un lookup Map indexado por "row_col" para acceso O(1) al grid.
 * Se cachea externamente (useMemo) para no recalcular cada frame.
 *
 * Nota: PostgreSQL DECIMAL devuelve strings. Parseamos explícitamente.
 *
 * @param {Array} gridData — Array de { latitud, longitud, wind_speed, wind_direction }
 * @returns {Map<string, { u: number, v: number }>}
 */
export function buildGridIndex(gridData) {
  const index = new Map();
  if (!gridData || gridData.length === 0) return index;

  for (const cell of gridData) {
    const lat = parseFloat(cell.latitud);
    const lon = parseFloat(cell.longitud);
    const speed = parseFloat(cell.wind_speed);
    const dir = parseFloat(cell.wind_direction);

    // Validación estricta: cualquier NaN descarta la celda
    if (!isFinite(lat) || !isFinite(lon)) continue;

    // Mapeo de coordenadas geográficas → índices del grid
    // lat -89.5 → row 0,  lat 89.5 → row 179
    // lon -179.5 → col 0, lon 179.5 → col 359
    const col = Math.round(lon + 179.5);
    const row = Math.round(lat + 89.5);

    if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

    const { u, v } = speedDirToUV(isFinite(speed) ? speed : 0, isFinite(dir) ? dir : 0);
    index.set(`${row}_${col}`, { u, v });
  }

  return index;
}

/**
 * Lee un punto del índice del grid. Retorna {0,0} si no existe.
 *
 * @param {Map} gridIndex
 * @param {number} col — Columna (0-359)
 * @param {number} row — Fila (0-179)
 * @returns {{ u: number, v: number }}
 */
function readCell(gridIndex, col, row) {
  // Wrap horizontal (antimeridiano)
  col = ((col % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH;
  // Clamp vertical (polos)
  row = Math.max(0, Math.min(row, GRID_HEIGHT - 1));

  return gridIndex.get(`${row}_${col}`) || { u: 0, v: 0 };
}

/**
 * Interpolación bilineal vectorial del viento en una coordenada continua.
 *
 * Descompone speed+direction → U,V en los 4 texeles vecinos,
 * interpola U y V por separado con mix(), y recompone la magnitud.
 *
 * @param {Map} gridIndex — Índice precalculado via buildGridIndex()
 * @param {number} lng — Longitud (-180 a 180, o cualquier rango — se normaliza)
 * @param {number} lat — Latitud (-90 a 90)
 * @returns {{ speed: number, u: number, v: number }}
 */
export function sampleWindBilinear(gridIndex, lng, lat) {
  if (!gridIndex || gridIndex.size === 0) return { speed: 0, u: 0, v: 0 };

  // Validar inputs
  if (!isFinite(lng) || !isFinite(lat)) {
    console.warn('[windMath] sampleWindBilinear: coordenadas inválidas', { lng, lat });
    return { speed: 0, u: 0, v: 0 };
  }

  // Normalizar longitud a rango [-180, 180)
  lng = ((lng % 360) + 540) % 360 - 180;
  // Clamp latitud a [-90, 90]
  lat = Math.max(-90, Math.min(90, lat));

  // Geo → coordenadas continuas del texel (centrado en el grid del backend)
  // lon -179.5 → texX 0.0, lon 179.5 → texX 359.0
  const texX = lng + 179.5;
  // lat -89.5 → texY 0.0, lat 89.5 → texY 179.0
  const texY = lat + 89.5;

  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;

  // Leer los 4 vecinos (con wrap horizontal y clamp vertical)
  const c00 = readCell(gridIndex, x0, y0);
  const c10 = readCell(gridIndex, x0 + 1, y0);
  const c01 = readCell(gridIndex, x0, y0 + 1);
  const c11 = readCell(gridIndex, x0 + 1, y0 + 1);

  // Interpolar U y V por separado (mix horizontal, luego vertical)
  const u = (c00.u * (1 - fx) + c10.u * fx) * (1 - fy) +
            (c01.u * (1 - fx) + c11.u * fx) * fy;

  const v = (c00.v * (1 - fx) + c10.v * fx) * (1 - fy) +
            (c01.v * (1 - fx) + c11.v * fx) * fy;

  // Recomponer magnitud desde el vector interpolado
  const speed = Math.sqrt(u * u + v * v);

  // Guardia final contra NaN (no debería ocurrir, pero seguridad defensiva)
  if (!isFinite(speed)) {
    console.warn('[windMath] sampleWindBilinear: resultado NaN', { lng, lat, texX, texY, x0, y0 });
    return { speed: 0, u: 0, v: 0 };
  }

  return { speed: Math.round(speed * 100) / 100, u, v };
}

/**
 * Genera un GeoJSON FeatureCollection con la velocidad del viento
 * interpolada vectorialmente para cada ciudad del catálogo.
 *
 * @param {Array} cities — Array de { name, lng, lat }
 * @param {Map} gridIndex — Índice precalculado via buildGridIndex()
 * @returns {Object} — GeoJSON FeatureCollection
 */
export function buildCitiesWindGeoJSON(cities, gridIndex) {
  const features = cities.map(city => {
    const { speed } = sampleWindBilinear(gridIndex, city.lng, city.lat);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [city.lng, city.lat] },
      properties: {
        name: city.name,
        wind_speed: speed,
      },
    };
  });

  return { type: 'FeatureCollection', features };
}

/**
 * Crea un índice optimizado para buscar valores de lluvia (escalar).
 * @param {Array} gridData 
 * @returns {Map} index structure
 */
export function buildRainGridIndex(gridData) {
  const index = new Map();
  if (!gridData || gridData.length === 0) return index;

  for (const cell of gridData) {
    const lat = parseFloat(cell.latitud);
    const lon = parseFloat(cell.longitud);
    const rain = parseFloat(cell.rain);

    if (!isFinite(lat) || !isFinite(lon)) continue;

    const col = Math.round(lon + 179.5);
    const row = Math.round(lat + 89.5);

    if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

    index.set(`${row}_${col}`, isFinite(rain) ? rain : 0);
  }

  return index;
}

/**
 * Lee un punto del índice de lluvia. Retorna 0 si no existe.
 */
function readRainCell(gridIndex, col, row) {
  col = ((col % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH;
  row = Math.max(0, Math.min(row, GRID_HEIGHT - 1));
  return gridIndex.get(`${row}_${col}`) || 0;
}

/**
 * Interpolación bilineal de lluvia (escalar) en una coordenada continua.
 *
 * @param {Map} gridIndex
 * @param {number} lng
 * @param {number} lat
 * @returns {number} Intensidad de lluvia (mm/h)
 */
export function sampleRainBilinear(gridIndex, lng, lat) {
  if (!gridIndex || gridIndex.size === 0) return 0;

  if (!isFinite(lng) || !isFinite(lat)) return 0;

  lng = ((lng % 360) + 540) % 360 - 180;
  lat = Math.max(-90, Math.min(90, lat));

  const texX = lng + 179.5;
  const texY = lat + 89.5;

  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;

  const r00 = readRainCell(gridIndex, x0, y0);
  const r10 = readRainCell(gridIndex, x0 + 1, y0);
  const r01 = readRainCell(gridIndex, x0, y0 + 1);
  const r11 = readRainCell(gridIndex, x0 + 1, y0 + 1);

  // Interpolar escalar directamente
  const bottom = r00 * (1 - fx) + r10 * fx;
  const top    = r01 * (1 - fx) + r11 * fx;
  const rain   = bottom * (1 - fy) + top * fy;

  return Math.max(0, Math.round(rain * 100) / 100);
}

/**
 * Crea un índice optimizado para buscar valores de nieve (escalar).
 */
export function buildSnowGridIndex(gridData) {
  const index = new Map();
  if (!gridData || gridData.length === 0) return index;

  for (const cell of gridData) {
    const lat = parseFloat(cell.latitud);
    const lon = parseFloat(cell.longitud);
    const snow = parseFloat(cell.snow);
    const snowFresh = parseFloat(cell.snow_fresh);

    if (!isFinite(lat) || !isFinite(lon)) continue;

    const col = Math.round(lon + 179.5);
    const row = Math.round(lat + 89.5);

    if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

    index.set(`${row}_${col}`, {
      accumulated: isFinite(snow) ? snow : 0,
      fresh: isFinite(snowFresh) ? snowFresh : 0
    });
  }

  return index;
}

function readSnowCell(gridIndex, col, row) {
  col = ((col % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH;
  row = Math.max(0, Math.min(row, GRID_HEIGHT - 1));
  return gridIndex.get(`${row}_${col}`) || { accumulated: 0, fresh: 0 };
}

export function sampleSnowBilinear(gridIndex, lng, lat) {
  if (!gridIndex || gridIndex.size === 0) return { accumulated: 0, fresh: 0 };
  if (!isFinite(lng) || !isFinite(lat)) return { accumulated: 0, fresh: 0 };
  
  lng = ((lng % 360) + 540) % 360 - 180;
  lat = Math.max(-90, Math.min(90, lat));
  
  const texX = lng + 179.5;
  const texY = lat + 89.5;
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;
  
  const s00 = readSnowCell(gridIndex, x0, y0);
  const s10 = readSnowCell(gridIndex, x0 + 1, y0);
  const s01 = readSnowCell(gridIndex, x0, y0 + 1);
  const s11 = readSnowCell(gridIndex, x0 + 1, y0 + 1);
  
  const bAcc = s00.accumulated * (1 - fx) + s10.accumulated * fx;
  const tAcc = s01.accumulated * (1 - fx) + s11.accumulated * fx;
  const acc = bAcc * (1 - fy) + tAcc * fy;

  const bFr = s00.fresh * (1 - fx) + s10.fresh * fx;
  const tFr = s01.fresh * (1 - fx) + s11.fresh * fx;
  const fr = bFr * (1 - fy) + tFr * fy;
  
  return {
    accumulated: Math.max(0, Math.round(acc * 100) / 100),
    fresh: Math.max(0, Math.round(fr * 100) / 100)
  };
}

/**
 * Crea un índice optimizado para buscar valores de visibilidad (escalar).
 */
export function buildVisibilityGridIndex(gridData) {
  const index = new Map();
  if (!gridData || gridData.length === 0) return index;

  for (const cell of gridData) {
    const lat = parseFloat(cell.latitud);
    const lon = parseFloat(cell.longitud);
    const vis = parseFloat(cell.vis); // asumiendo que el JSON tiene .vis

    if (!isFinite(lat) || !isFinite(lon)) continue;

    const col = Math.round(lon + 179.5);
    const row = Math.round(lat + 89.5);

    if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

    index.set(`${row}_${col}`, isFinite(vis) ? vis : 0);
  }

  return index;
}

export function sampleVisibilityBilinear(gridIndex, lng, lat) {
  if (!gridIndex || gridIndex.size === 0) return 0;
  if (!isFinite(lng) || !isFinite(lat)) return 0;
  
  lng = ((lng % 360) + 540) % 360 - 180;
  lat = Math.max(-90, Math.min(90, lat));
  
  const texX = lng + 179.5;
  const texY = lat + 89.5;
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;
  
  const v00 = readRainCell(gridIndex, x0, y0);
  const v10 = readRainCell(gridIndex, x0 + 1, y0);
  const v01 = readRainCell(gridIndex, x0, y0 + 1);
  const v11 = readRainCell(gridIndex, x0 + 1, y0 + 1);
  
  const bottom = v00 * (1 - fx) + v10 * fx;
  const top    = v01 * (1 - fx) + v11 * fx;
  const vis    = bottom * (1 - fy) + top * fy;
  
  return Math.max(0, Math.round(vis * 100) / 100);
}

/**
 * Crea un índice optimizado para buscar valores de temperatura (escalar).
 */
export function buildTempGridIndex(gridData) {
  const index = new Map();
  if (!gridData || gridData.length === 0) return index;

  for (const cell of gridData) {
    const lat = parseFloat(cell.latitud);
    const lon = parseFloat(cell.longitud);
    const temp = parseFloat(cell.temp || cell.temperatura); // Soporta ambas convenciones

    if (!isFinite(lat) || !isFinite(lon)) continue;

    const col = Math.round(lon + 179.5);
    const row = Math.round(lat + 89.5);

    if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

    index.set(`${row}_${col}`, isFinite(temp) ? temp : null);
  }

  return index;
}

function readTempCell(gridIndex, col, row) {
  col = ((col % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH;
  row = Math.max(0, Math.min(row, GRID_HEIGHT - 1));
  return gridIndex.get(`${row}_${col}`) || null;
}

/**
 * Interpolación bilineal de temperatura (escalar) en una coordenada continua.
 * Retorna en Kelvin crudo (o null si no hay datos).
 */
export function sampleTempBilinear(gridIndex, lng, lat) {
  if (!gridIndex || gridIndex.size === 0) return null;
  if (!isFinite(lng) || !isFinite(lat)) return null;
  
  lng = ((lng % 360) + 540) % 360 - 180;
  lat = Math.max(-90, Math.min(90, lat));
  
  const texX = lng + 179.5;
  const texY = lat + 89.5;
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;
  
  const t00 = readTempCell(gridIndex, x0, y0);
  const t10 = readTempCell(gridIndex, x0 + 1, y0);
  const t01 = readTempCell(gridIndex, x0, y0 + 1);
  const t11 = readTempCell(gridIndex, x0 + 1, y0 + 1);
  
  // Si falta alguno de los 4, retornamos null para no promediar contra 0K (-273C)
  if (t00 === null || t10 === null || t01 === null || t11 === null) return null;

  const bottom = t00 * (1 - fx) + t10 * fx;
  const top    = t01 * (1 - fx) + t11 * fx;
  const temp   = bottom * (1 - fy) + top * fy;
  
  return temp;
}

