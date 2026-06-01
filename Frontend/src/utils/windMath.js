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

// ═══════════════════════════════════════════════════════════════════════
// PNG DATA TEXTURE PIPELINE — Funciones de lectura de píxeles RGBA
// Estas funciones trabajan sobre Uint8ClampedArray extraída de los PNGs
// que el backend genera como Data Textures RGBA 360×180.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Extrae el array de píxeles RGBA de un HTMLImageElement usando OffscreenCanvas.
 * El resultado es un Uint8ClampedArray de 360*180*4 bytes.
 *
 * @param {HTMLImageElement} imgElement — Imagen PNG cargada del backend
 * @returns {{ data: Uint8ClampedArray, width: number, height: number } | null}
 */
export function getImageDataArray(imgElement) {
  if (!imgElement || imgElement.width === 0 || imgElement.height === 0) return null;

  const w = imgElement.width;
  const h = imgElement.height;

  // Preferir OffscreenCanvas si está disponible (sin contaminar el DOM)
  let canvas, ctx;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(w, h);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  } else {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }

  ctx.drawImage(imgElement, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  return { data: imageData.data, width: w, height: h };
}

/**
 * Lee los 4 bytes RGBA de un píxel específico del grid.
 * Aplica wrap horizontal (antimeridiano) y clamp vertical (polos).
 *
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} imgData
 * @param {number} col — Columna (puede ser negativa o > 359, se wrappea)
 * @param {number} row — Fila (se clampea a [0, height-1])
 * @returns {[number, number, number, number]} — [R, G, B, A]
 */
function readPixel(imgData, col, row) {
  const w = imgData.width;
  const h = imgData.height;

  // Wrap horizontal (antimeridiano)
  col = ((col % w) + w) % w;
  // Clamp vertical (polos)
  row = Math.max(0, Math.min(row, h - 1));

  const idx = (row * w + col) * 4;
  return [
    imgData.data[idx],
    imgData.data[idx + 1],
    imgData.data[idx + 2],
    imgData.data[idx + 3]
  ];
}

// Helper: convierte lng/lat a coordenadas de texel continuas
function _geoToTexel(lng, lat) {
  lng = ((lng % 360) + 540) % 360 - 180;
  lat = Math.max(-90, Math.min(90, lat));
  return { texX: lng + 179.5, texY: lat + 89.5 };
}

// ─── VIENTO (PNG: R=speed, G=dir, B=gust) ──────────────────────────
// R: speed / 150 * 255 => speed = (R / 255) * 150
// G: dir / 360 * 255   => dir   = (G / 255) * 360
// B: gust / 150 * 255  => gust  = (B / 255) * 150
export function sampleWindBilinear(data, lng, lat) {
  if (!data) return { speed: 0, u: 0, v: 0 };
  if (!isFinite(lng) || !isFinite(lat)) return { speed: 0, u: 0, v: 0 };

  const { texX, texY } = _geoToTexel(lng, lat);
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;

  const decode = (p) => {
    if (p[3] === 0) return { speed: 0, dir: 0 };
    return {
      speed: (p[0] / 255.0) * 150.0,
      dir: (p[1] / 255.0) * 360.0
    };
  };

  const w00 = decode(readPixel(data, x0, y0));
  const w10 = decode(readPixel(data, x0 + 1, y0));
  const w01 = decode(readPixel(data, x0, y0 + 1));
  const w11 = decode(readPixel(data, x0 + 1, y0 + 1));

  // Descomponer a U/V para interpolar vectorialmente
  const toUV = (s, d) => speedDirToUV(s, d);
  const uv00 = toUV(w00.speed, w00.dir);
  const uv10 = toUV(w10.speed, w10.dir);
  const uv01 = toUV(w01.speed, w01.dir);
  const uv11 = toUV(w11.speed, w11.dir);

  const u = (uv00.u * (1 - fx) + uv10.u * fx) * (1 - fy) +
            (uv01.u * (1 - fx) + uv11.u * fx) * fy;
  const v = (uv00.v * (1 - fx) + uv10.v * fx) * (1 - fy) +
            (uv01.v * (1 - fx) + uv11.v * fx) * fy;

  const speed = Math.sqrt(u * u + v * v);
  return { speed: Math.round(speed * 100) / 100, u, v };
}

// ─── VISIBILIDAD (PNG: R=G=B=norm) ─────────────────────────────────
// R = vis / 24135 * 255 => vis = (R / 255) * 24135
export function sampleVisibilityBilinear(data, lng, lat) {
  if (!data) return null;

  const { texX, texY } = _geoToTexel(lng, lat);
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;

  const getVis = (p) => p[3] === 0 ? null : (p[0] / 255.0) * 24135.0;

  const v00 = getVis(readPixel(data, x0, y0));
  const v10 = getVis(readPixel(data, x0 + 1, y0));
  const v01 = getVis(readPixel(data, x0, y0 + 1));
  const v11 = getVis(readPixel(data, x0 + 1, y0 + 1));

  if (v00 === null || v10 === null || v01 === null || v11 === null) return null;

  const bottom = v00 * (1 - fx) + v10 * fx;
  const top = v01 * (1 - fx) + v11 * fx;
  return bottom * (1 - fy) + top * fy;
}

// ─── NIEVE (PNG: R=acumulada, G=fresca) ────────────────────────────
// R = accum / 150 * 255 => accum = (R / 255) * 150
// G = fresh / 300 * 255 => fresh = (G / 255) * 300
export function sampleSnowBilinear(data, lng, lat) {
  if (!data) return null;

  const { texX, texY } = _geoToTexel(lng, lat);
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;

  const getSnow = (p) => {
    if (p[3] === 0) return { a: 0, f: 0 };
    return { a: (p[0] / 255.0) * 150.0, f: (p[1] / 255.0) * 300.0 };
  };

  const s00 = getSnow(readPixel(data, x0, y0));
  const s10 = getSnow(readPixel(data, x0 + 1, y0));
  const s01 = getSnow(readPixel(data, x0, y0 + 1));
  const s11 = getSnow(readPixel(data, x0 + 1, y0 + 1));

  const accBottom = s00.a * (1 - fx) + s10.a * fx;
  const accTop = s01.a * (1 - fx) + s11.a * fx;
  const accumulated = accBottom * (1 - fy) + accTop * fy;

  const freBottom = s00.f * (1 - fx) + s10.f * fx;
  const freTop = s01.f * (1 - fx) + s11.f * fx;
  const fresh = freBottom * (1 - fy) + freTop * fy;

  return { accumulated, fresh };
}

// ─── LLUVIA (PNG: R=G=B=norm no-lineal) ────────────────────────────
const RAIN_STOPS = [
  0.0, 0.2, 0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 7.5, 10.0,
  15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 50.0, 60.0, 70.0, 85.0, 100.0, 150.0
];
const RAIN_STOPS_COUNT = RAIN_STOPS.length;

function decodeRain(byteVal) {
  if (byteVal === 0) return 0;
  const norm = byteVal / 255.0;
  const virtualIndex = norm * (RAIN_STOPS_COUNT - 1);
  let i = Math.floor(virtualIndex);
  let t = virtualIndex - i;
  if (i >= RAIN_STOPS_COUNT - 1) return RAIN_STOPS[RAIN_STOPS_COUNT - 1];
  return RAIN_STOPS[i] + t * (RAIN_STOPS[i + 1] - RAIN_STOPS[i]);
}

export function sampleRainBilinear(data, lng, lat) {
  if (!data) return null;

  const { texX, texY } = _geoToTexel(lng, lat);
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;

  const getRain = (p) => p[3] === 0 ? 0 : decodeRain(p[0]);

  const r00 = getRain(readPixel(data, x0, y0));
  const r10 = getRain(readPixel(data, x0 + 1, y0));
  const r01 = getRain(readPixel(data, x0, y0 + 1));
  const r11 = getRain(readPixel(data, x0 + 1, y0 + 1));

  const bottom = r00 * (1 - fx) + r10 * fx;
  const top = r01 * (1 - fx) + r11 * fx;
  return bottom * (1 - fy) + top * fy;
}

// ─── AQI (PNG: Nearest Neighbor) ───────────────────────────────────
// byte = Math.round(aqi / 2.0) => aqi = byte * 2.0
export function sampleAqiNearest(data, lng, lat) {
  if (!data) return null;

  const { texX, texY } = _geoToTexel(lng, lat);

  const col = Math.round(texX);
  const row = Math.round(texY);

  const p = readPixel(data, col, row);
  if (p[3] === 0) return null;
  return p[0] * 2.0;
}

// ─── TEMPERATURA (PNG: R=G=B=norm) ─────────────────────────────────
// R = (tempC + 60) / 120 * 255 => tempK = ((R / 255) * 120 - 60) + 273.15
export function sampleTempBilinear(data, lng, lat) {
  if (!data) return null;

  const { texX, texY } = _geoToTexel(lng, lat);
  const x0 = Math.floor(texX);
  const y0 = Math.floor(texY);
  const fx = texX - x0;
  const fy = texY - y0;

  const getTemp = (p) => {
    if (p[3] === 0) return null;
    const tempC = (p[0] / 255.0) * 120.0 - 60.0;
    return tempC + 273.15; // Retornamos en Kelvin para compatibilidad
  };

  const t00 = getTemp(readPixel(data, x0, y0));
  const t10 = getTemp(readPixel(data, x0 + 1, y0));
  const t01 = getTemp(readPixel(data, x0, y0 + 1));
  const t11 = getTemp(readPixel(data, x0 + 1, y0 + 1));

  if (t00 === null || t10 === null || t01 === null || t11 === null) return null;

  const bottom = t00 * (1 - fx) + t10 * fx;
  const top = t01 * (1 - fx) + t11 * fx;
  return bottom * (1 - fy) + top * fy;
}

