/**
 * AqiDataTexture.js — Gestor de texturas WebGL para datos de AQI.
 *
 * Pipeline PNG RGBA: Recibe HTMLImageElement directamente del backend.
 * Grid: 360×180 (alineado con el resto de capas).
 */

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;

export default class AqiDataTexture {
  constructor(gl) {
    this.gl = gl;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    this.dataTextureCurrent = gl.createTexture();
    this.dataTextureNext = gl.createTexture();

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);

    // Init Current
    gl.bindTexture(gl.TEXTURE_2D, this.dataTextureCurrent);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);

    // Init Next
    gl.bindTexture(gl.TEXTURE_2D, this.dataTextureNext);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyData);
  }

  update(imgData) {
    if (!imgData) return;
    this.updateDual(imgData, imgData);
  }

  updateDual(currentData, nextData) {
    const gl = this.gl;

    if (currentData instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.dataTextureCurrent);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentData);
    }

    const nextSource = nextData || currentData;
    if (nextSource instanceof HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, this.dataTextureNext);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextSource);
    }
  }

  destroy() {
    const gl = this.gl;
    if (this.dataTextureCurrent) gl.deleteTexture(this.dataTextureCurrent);
    if (this.dataTextureNext) gl.deleteTexture(this.dataTextureNext);
    this.dataTextureCurrent = null;
    this.dataTextureNext = null;
  }
}
