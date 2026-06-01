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

    this.visTextureCurrent = gl.createTexture();
    this.visTextureNext = gl.createTexture();

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);

    // Init Current
    gl.bindTexture(gl.TEXTURE_2D, this.visTextureCurrent);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

    // Init Next
    gl.bindTexture(gl.TEXTURE_2D, this.visTextureNext);
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

  update(gridData) {
    if (!gridData) return;
    this.updateDual(gridData, gridData);
  }

  updateDual(currentData, nextData) {
    const gl = this.gl;

    if (currentData instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.visTextureCurrent);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentData);
    }

    const nextSource = nextData || currentData;
    if (nextSource instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.visTextureNext);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextSource);
    }
  }

  setColorRamp(ramp) {
    this.colorRamp = ramp;
    this._uploadRamp(ramp);
  }

  destroy() {
    const gl = this.gl;
    if (this.visTextureCurrent) gl.deleteTexture(this.visTextureCurrent);
    if (this.visTextureNext) gl.deleteTexture(this.visTextureNext);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.visTextureCurrent = null;
    this.visTextureNext = null;
    this.rampTexture = null;
  }
}
