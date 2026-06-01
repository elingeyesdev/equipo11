/**
 * RainDataTexture.js — Gestor de texturas WebGL para datos de lluvia de la NOAA.
 *
 * SRP: Se ocupa de codificar datos escalares del grid en textura GPU.
 *  - Textura 2D de intensidad de lluvia (360x180, LUMINANCE)
 */

import { buildRainColorRampTexture, DEFAULT_RAIN_RAMP } from './colorRamps_rain.js';

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MAX_RAIN = 150.0;

export default class RainDataTexture {
  /**
   * @param {WebGLRenderingContext} gl
   * @param {Array} colorRamp
   */
  constructor(gl, colorRamp = DEFAULT_RAIN_RAMP) {
    this.gl = gl;
    this.maxRain = MAX_RAIN;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;
    this.colorRamp = colorRamp;

    // --- Textura de datos de lluvia (360x180, RGBA, UNSIGNED_BYTE) ---
    this.rainTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Inicializar con ceros (RGBA)
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, emptyData
    );

    // --- Textura de paleta de color (256×1, RGBA) ---
    this.rampTexture = gl.createTexture();
    this._uploadRamp(this.colorRamp);
  }

  /**
   * Sube la paleta de color a la GPU.
   */
  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildRainColorRampTexture(ramp);

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
    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gridData);
  }

  setColorRamp(ramp) {
    this.colorRamp = ramp;
    this._uploadRamp(ramp);
  }

  destroy() {
    const gl = this.gl;
    if (this.rainTexture) gl.deleteTexture(this.rainTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.rainTexture = null;
    this.rampTexture = null;
  }
}
