/**
 * TempDataTexture.js — Gestor de texturas WebGL para datos de temperatura global.
 *
 * SRP: Solo se ocupa de codificar datos del grid en texturas GPU.
 *  - Textura 2D de temperatura (360×180, equirectangular, LUMINANCE)
 *  - Textura 1D de paleta de color (256×1, RGBA)
 *
 * Arquitectura clonada de WindDataTexture.js para garantizar
 * alineación píxel-perfect y rendimiento idéntico.
 */

// Constantes del grid global (1° resolución, centros en ±0.5)
const GRID_WIDTH  = 360;
const GRID_HEIGHT = 180;
const MIN_TEMP    = -40;  // °C — límite inferior de normalización
const MAX_TEMP    =  50;  // °C — límite superior de normalización
const TEMP_RANGE  = MAX_TEMP - MIN_TEMP; // 90°C

// ─── Paleta de Colores: Leyenda Meteorológica de 48 tonos ─────────────

/**
 * Genera un array RGBA de 256 colores interpolando linealmente
 * entre los 11 stops de la leyenda meteorológica.
 *
 * @returns {Uint8Array} — 256 × 4 bytes (RGBA), listo para subir como textura
 */
function buildTempColorRampTexture() {
  const size = 256;
  const pixels = new Uint8Array(size * 4);

  // Los 11 stops de la leyenda meteorológica.
  // Cada stop: { t: posición normalizada [0,1], color: [R, G, B] en 0-255 }
  const stops = [
    { t: 0.00, color: [255,   0, 255] },  // -40°C  Magenta
    { t: 0.11, color: [128,   0, 128] },  // -30°C  Púrpura
    { t: 0.22, color: [  0,   0, 139] },  // -20°C  Azul oscuro
    { t: 0.33, color: [  0,   0, 255] },  // -10°C  Azul claro
    { t: 0.44, color: [  0, 255, 255] },  //   0°C  Cian
    { t: 0.45, color: [  0, 128, 128] },  //  +1°C  Teal (salto brusco en congelación)
    { t: 0.55, color: [  0, 255,   0] },  //  10°C  Verde claro
    { t: 0.66, color: [255, 255,   0] },  //  20°C  Amarillo
    { t: 0.77, color: [255, 165,   0] },  //  30°C  Naranja
    { t: 0.88, color: [139,   0,   0] },  //  40°C  Rojo oscuro
    { t: 1.00, color: [128, 128, 128] },  //  50°C  Gris
  ];

  for (let i = 0; i < size; i++) {
    const norm = i / (size - 1); // posición normalizada [0, 1]

    // Encontrar los dos stops que encierran este valor
    let lo = stops[0];
    let hi = stops[stops.length - 1];

    for (let j = 0; j < stops.length - 1; j++) {
      if (norm >= stops[j].t && norm <= stops[j + 1].t) {
        lo = stops[j];
        hi = stops[j + 1];
        break;
      }
    }

    const range = hi.t - lo.t;
    const t = range > 0 ? Math.min(1, Math.max(0, (norm - lo.t) / range)) : 0;

    pixels[i * 4 + 0] = Math.round(lo.color[0] + t * (hi.color[0] - lo.color[0]));
    pixels[i * 4 + 1] = Math.round(lo.color[1] + t * (hi.color[1] - lo.color[1]));
    pixels[i * 4 + 2] = Math.round(lo.color[2] + t * (hi.color[2] - lo.color[2]));
    pixels[i * 4 + 3] = 255; // Alfa opaco — la transparencia se controla via u_opacity
  }

  return pixels;
}

export default class TempDataTexture {
  /**
   * @param {WebGLRenderingContext} gl
   */
  constructor(gl) {
    this.gl = gl;
    this.gridWidth  = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    // --- Textura de datos de temperatura (360×180, LUMINANCE, UNSIGNED_BYTE) ---
    this.tempTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture);

    // NEAREST + CLAMP_TO_EDGE — la interpolación bilineal se hace en el shader
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Inicializar con ceros
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, emptyData
    );

    // --- Textura de paleta de color (256×1, RGBA) ---
    this.rampTexture = gl.createTexture();
    this._uploadRamp();
  }

  /**
   * Sube la paleta de color a la GPU.
   */
  _uploadRamp() {
    const gl = this.gl;
    const pixels = buildTempColorRampTexture();

    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      256, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, pixels
    );
  }

  /**
   * Actualiza la textura de datos con el grid de temperatura actual.
   * @param {Array} gridData — Array de { latitud, longitud, temp/temperatura/val }
   */
  update(gridData) {
    if (!gridData || gridData.length === 0) return;

    const gl = this.gl;
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

    for (const point of gridData) {
      // PostgreSQL devuelve DECIMAL como string — parsear explícitamente
      const lat = Number(point.latitud !== undefined ? point.latitud : point.lat);
      const lon = Number(point.longitud !== undefined ? point.longitud : point.lon);

      if (isNaN(lat) || isNaN(lon)) continue;

      // Leer temperatura (soporta múltiples nombres de campo)
      const tempKelvin = point.temp !== undefined
        ? parseFloat(point.temp)
        : (point.temperatura !== undefined
          ? parseFloat(point.temperatura)
          : parseFloat(point.val));

      if (isNaN(tempKelvin) || tempKelvin === 0) continue;

      // Mapear coordenadas geográficas a índices de textura
      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      // Convertir Kelvin -> Celsius y normalizar a [0, 255]
      const tempC = tempKelvin - 273.15;
      const norm = Math.max(0, Math.min(1, (tempC - MIN_TEMP) / TEMP_RANGE));
      pixels[row * GRID_WIDTH + col] = Math.round(norm * 255);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels
    );
  }

  /**
   * Libera recursos GPU.
   */
  destroy() {
    const gl = this.gl;
    if (this.tempTexture) gl.deleteTexture(this.tempTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.tempTexture = null;
    this.rampTexture = null;
  }
}
