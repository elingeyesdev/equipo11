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

    this.windTextureCurrent = gl.createTexture();
    this.windTextureNext = gl.createTexture();

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);

    // Init Current
    gl.bindTexture(gl.TEXTURE_2D, this.windTextureCurrent);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

    // Init Next
    gl.bindTexture(gl.TEXTURE_2D, this.windTextureNext);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

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

  update(gridData) {
    if (!gridData) return;
    this.updateDual(gridData, gridData);
  }

  updateDual(currentData, nextData) {
    const gl = this.gl;

    if (currentData instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.windTextureCurrent);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentData);
    }

    const nextSource = nextData || currentData;
    if (nextSource instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.windTextureNext);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextSource);
    }
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
    if (this.windTextureCurrent) gl.deleteTexture(this.windTextureCurrent);
    if (this.windTextureNext) gl.deleteTexture(this.windTextureNext);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.windTextureCurrent = null;
    this.windTextureNext = null;
    this.rampTexture = null;
  }
}
