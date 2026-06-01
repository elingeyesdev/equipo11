/**
 * VisibilityDataTexture.js — Gestor de texturas WebGL para datos de Visibilidad.
 * Empaqueta la visibilidad en gl.LUMINANCE mapeándola no linealmente.
 */

import { buildVisibilityColorRampTexture, DEFAULT_VIS_RAMP } from './colorRamps_vis.js';

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;

export default class VisibilityDataTexture {
  /**
   * @param {WebGLRenderingContext} gl
   * @param {Array} colorRamp
   */
  constructor(gl, colorRamp = DEFAULT_VIS_RAMP) {
    this.gl = gl;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;
    this.colorRamp = colorRamp;

    this.visTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.visTexture);

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
    this._uploadRamp(this.colorRamp);
  }

  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildVisibilityColorRampTexture(ramp);

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
    gl.bindTexture(gl.TEXTURE_2D, this.visTexture);
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
    if (this.visTexture) gl.deleteTexture(this.visTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.visTexture = null;
    this.rampTexture = null;
  }
}
