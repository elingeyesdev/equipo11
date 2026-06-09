import { buildRainColorRampTexture } from './colorRamps_rain';

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;

export default class RainDataTexture {
  constructor(gl) {
    this.gl = gl;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    this.rainTextureCurrent = this._createDataTexture(gl);
    this.rainTextureNext = this._createDataTexture(gl);

    this.rampTexture = gl.createTexture();
    this._uploadRamp();
  }

  _createDataTexture(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
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
    return tex;
  }

  _uploadRamp() {
    const gl = this.gl;
    const pixels = buildRainColorRampTexture();

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
    if (this.pendingCurrentImg && this.pendingCurrentImg !== this.lastCurrentImg) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.rainTextureCurrent);
      // 1. Prevenir wrap en texturas NPOT (Obligatorio)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // 2. Forzar suavizado bilineal (Elimina el pixelado/efecto Minecraft)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.pendingCurrentImg);
      this.lastCurrentImg = this.pendingCurrentImg;
    }
    if (this.pendingNextImg && this.pendingNextImg !== this.lastNextImg) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.rainTextureNext);
      // 1. Prevenir wrap en texturas NPOT (Obligatorio)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // 2. Forzar suavizado bilineal (Elimina el pixelado/efecto Minecraft)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.pendingNextImg);
      this.lastNextImg = this.pendingNextImg;
    }
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
