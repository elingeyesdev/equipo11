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

    this.rainTextureCurrent = gl.createTexture();
    this.rainTextureNext = gl.createTexture();

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);

    // Init Current
    gl.bindTexture(gl.TEXTURE_2D, this.rainTextureCurrent);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

    // Init Next
    gl.bindTexture(gl.TEXTURE_2D, this.rainTextureNext);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

    this.rampTexture = gl.createTexture();
    this._uploadRamp(this.colorRamp);
  }

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

  update(gridData) {
    if (!gridData) return;
    this.updateDual(gridData, gridData);
  }

  updateDual(currentData, nextData) {
    const gl = this.gl;

    if (currentData instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.rainTextureCurrent);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentData);
    }

    const nextSource = nextData || currentData;
    if (nextSource instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.rainTextureNext);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextSource);
    }
  }

  setColorRamp(ramp) {
    this.colorRamp = ramp;
    this._uploadRamp(ramp);
  }

  destroy() {
    const gl = this.gl;
    if (this.rainTextureCurrent) gl.deleteTexture(this.rainTextureCurrent);
    if (this.rainTextureNext) gl.deleteTexture(this.rainTextureNext);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.rainTextureCurrent = null;
    this.rainTextureNext = null;
    this.rampTexture = null;
  }
}
