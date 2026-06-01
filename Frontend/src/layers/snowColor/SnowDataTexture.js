/**
 * SnowDataTexture.js — Gestor de texturas WebGL para datos de Nieve.
 * Empaqueta la nieve (fresca o acumulada) en gl.LUMINANCE de 1 byte.
 */

import { buildSnowColorRampTexture, SNOW_FRESH_RAMP, SNOW_ACCUMULATED_RAMP } from './colorRamps_snow.js';

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;

export default class SnowDataTexture {
  constructor(gl) {
    this.gl = gl;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    this.snowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.snowTexture);

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

    this.rampTexture = gl.createTexture();
    this._uploadRamp(SNOW_ACCUMULATED_RAMP);
  }

  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildSnowColorRampTexture(ramp);

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
   * @param {number} snowType — 0: acumulada, 1: fresca
   */
  update(gridData, snowType = 0) {
    if (!gridData || !(gridData instanceof HTMLImageElement)) return;

    const gl = this.gl;

    // Seleccionar rampa según el tipo (0: acumulada, 1: fresca)
    const activeRamp = snowType === 1 ? SNOW_FRESH_RAMP : SNOW_ACCUMULATED_RAMP;
    this._uploadRamp(activeRamp);

    gl.bindTexture(gl.TEXTURE_2D, this.snowTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gridData);
  }

  destroy() {
    const gl = this.gl;
    if (this.snowTexture) gl.deleteTexture(this.snowTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.snowTexture = null;
    this.rampTexture = null;
  }
}
