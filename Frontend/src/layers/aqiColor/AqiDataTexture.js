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

    // Textura de datos AQI (RGBA, UNSIGNED_BYTE)
    this.dataTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Inicializar vacía (RGBA)
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, emptyData
    );
  }

  /**
   * Actualiza la textura con un PNG RGBA del backend.
   * @param {HTMLImageElement} imgData — Imagen PNG RGBA 360×180
   */
  update(imgData) {
    if (!imgData || !(imgData instanceof HTMLImageElement)) return;

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgData);
  }

  destroy() {
    const gl = this.gl;
    if (this.dataTexture) gl.deleteTexture(this.dataTexture);
    this.dataTexture = null;
  }
}
