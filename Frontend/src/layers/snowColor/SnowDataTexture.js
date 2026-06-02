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

    this.snowTextureCurrent = gl.createTexture();
    this.snowTextureNext = gl.createTexture();

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);

    // Init Current
    gl.bindTexture(gl.TEXTURE_2D, this.snowTextureCurrent);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

    // Init Next
    gl.bindTexture(gl.TEXTURE_2D, this.snowTextureNext);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

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

  update(gridData, snowType = 0) {
    if (!gridData) return;
    this.updateDual(gridData, gridData, snowType);
  }

  updateDual(currentData, nextData, snowType = 0) {
    this.pendingSnowType = snowType;
    if (currentData instanceof HTMLImageElement) {
      this.pendingCurrentImg = currentData;
    }
    const nextSource = nextData || currentData;
    if (nextSource instanceof HTMLImageElement) {
      this.pendingNextImg = nextSource;
    }
  }

  uploadPendingTextures() {
    const gl = this.gl;

    if (this.pendingSnowType !== undefined) {
      const activeRamp = this.pendingSnowType === 1 ? SNOW_FRESH_RAMP : SNOW_ACCUMULATED_RAMP;
      this._uploadRamp(activeRamp);
      this.pendingSnowType = undefined;
    }

    if (this.pendingCurrentImg && this.pendingCurrentImg !== this.lastCurrentImg) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.snowTextureCurrent);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.pendingCurrentImg);
      this.lastCurrentImg = this.pendingCurrentImg;
    }
    if (this.pendingNextImg && this.pendingNextImg !== this.lastNextImg) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.snowTextureNext);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.pendingNextImg);
      this.lastNextImg = this.pendingNextImg;
    }
  }

  destroy() {
    const gl = this.gl;
    if (this.snowTextureCurrent) gl.deleteTexture(this.snowTextureCurrent);
    if (this.snowTextureNext) gl.deleteTexture(this.snowTextureNext);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.snowTextureCurrent = null;
    this.snowTextureNext = null;
    this.rampTexture = null;
  }
}
