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
const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MIN_TEMP = -60;  // °C — límite inferior de normalización
const MAX_TEMP = 60;  // °C — límite superior de normalización
const TEMP_RANGE = MAX_TEMP - MIN_TEMP; // 120°C

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
  // Rango: 0.0 = -60°C, 1.0 = +60°C (120° de amplitud)
  const stops = [
    { t: 0.00, color: [255, 255, 255] },  // -60°C  Blanco puro
    { t: 0.08, color: [255, 255, 255] },  // -50.4°C Blanco puro
    { t: 0.20, color: [128, 0, 128] },  // -36°C  Violeta/Magenta oscuro
    { t: 0.40, color: [0, 0, 255] },  // -12°C  Azul
    { t: 0.50, color: [0, 255, 255] },  //   0°C  Cian
    { t: 0.60, color: [0, 255, 0] },  //  12°C  Verde
    { t: 0.75, color: [255, 165, 0] },  //  30°C  Naranja
    { t: 0.79, color: [255, 0, 0] },  //  35°C  Rojo Puro
    { t: 0.85, color: [178, 34, 34] },  //  42°C  Rojo Carmesí
    { t: 1.00, color: [59, 0, 0] },  //  60°C  Granate casi negro
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
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    // --- Texturas de datos de temperatura (360×180, LUMINANCE, UNSIGNED_BYTE) ---
    this.tempTextureCurrent = this._createDataTexture(gl);
    this.tempTextureNext = this._createDataTexture(gl);

    // --- Textura de paleta de color (256×1, RGBA) ---
    this.rampTexture = gl.createTexture();
    this._uploadRamp();
  }

  _createDataTexture(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, emptyData
    );
    return tex;
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

  update(gridData) {
    if (!gridData) return;
    this.updateDual(gridData, gridData);
  }

  /**
   * Sube datos a las texturas Current y Next.
   * Acepta exclusivamente HTMLImageElement (Pipeline PNG RGBA).
   */
  updateDual(currentData, nextData) {
    const gl = this.gl;

    // --- Textura Current ---
    if (currentData instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.tempTextureCurrent);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentData);
    }

    // --- Textura Next ---
    const nextSource = nextData || currentData;
    if (nextSource instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.tempTextureNext);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextSource);
    }
  }

  /**
   * Libera recursos GPU.
   */
  destroy() {
    const gl = this.gl;
    if (this.tempTextureCurrent) gl.deleteTexture(this.tempTextureCurrent);
    if (this.tempTextureNext) gl.deleteTexture(this.tempTextureNext);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.tempTextureCurrent = null;
    this.tempTextureNext = null;
    this.rampTexture = null;
  }
}
