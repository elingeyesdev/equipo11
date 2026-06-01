/**
 * WindDataTexture.js — Gestor de texturas WebGL para datos NOAA.
 *
 * SRP: Solo se ocupa de codificar datos del grid en texturas GPU.
 *  - Textura 2D de velocidades (360×180, equirectangular, LUMINANCE)
 *  - Textura 1D de paleta de color (256×1, RGBA)
 */

import { buildColorRampTexture, DEFAULT_RAMP } from './colorRamps.js';

// Constantes del grid global (1° resolución, centros en ±0.5)
const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MAX_SPEED = 150; // km/h — para normalizar a [0, 1]

export default class WindDataTexture {
  /**
   * @param {WebGLRenderingContext} gl
   * @param {Array} colorRamp — paleta de colores (default: BEAUFORT)
   */
  constructor(gl, colorRamp = DEFAULT_RAMP) {
    this.gl = gl;
    this.maxSpeed = MAX_SPEED;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;
    // --- Textura de datos de viento (360×180, LUMINANCE, UNSIGNED_BYTE) ---
    this.windTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture);

    // Forzamos NEAREST y CLAMP_TO_EDGE (KISS). 
    // La interpolación bilineal con wrap del antimeridiano se hace SIEMPRE en el shader.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Inicializar con ceros
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, emptyData
    );

    // --- Textura de paleta de color (256×1, RGBA) ---
    this.rampTexture = gl.createTexture();
    this._uploadRamp(colorRamp);
  }

  /**
   * Sube la paleta de color a la GPU.
   * @param {Array} ramp
   */
  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildColorRampTexture(ramp, this.maxSpeed);

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
   * Actualiza la textura de datos con un PNG RGBA del backend.
   * @param {HTMLImageElement} gridData — Imagen PNG RGBA 360×180
   */
  update(gridData) {
    if (!gridData || !(gridData instanceof HTMLImageElement)) return;

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gridData);
  }

  /**
   * Cambia la paleta de colores dinámicamente (OCP).
   * @param {Array} ramp
   */
  setColorRamp(ramp) {
    this._uploadRamp(ramp);
  }

  /**
   * Libera recursos GPU.
   */
  destroy() {
    const gl = this.gl;
    if (this.windTexture) gl.deleteTexture(this.windTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.windTexture = null;
    this.rampTexture = null;
  }
}
