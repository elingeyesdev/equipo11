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

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, emptyData
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

  update(gridData, snowType = 0) {
    if (!gridData || gridData.length === 0) return;

    const gl = this.gl;
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    
    // Seleccionar rampa según el tipo (0: acumulada, 1: fresca)
    const activeRamp = snowType === 1 ? SNOW_FRESH_RAMP : SNOW_ACCUMULATED_RAMP;
    this._uploadRamp(activeRamp);

    const stopsCount = activeRamp.length;

    for (const point of gridData) {
      const lat = Number(point.latitud !== undefined ? point.latitud : point.lat);
      const lon = Number(point.longitud !== undefined ? point.longitud : point.lon);

      if (isNaN(lat) || isNaN(lon)) continue;

      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      let value = 0;
      if (snowType === 1) {
        value = Number(point.snow_fresh !== undefined ? point.snow_fresh : 0);
      } else {
        value = Number(point.snow !== undefined ? point.snow : 0);
      }
      
      if (isNaN(value) || value < 0) value = 0;

      let norm = 0;
      if (value <= activeRamp[0].val) {
        norm = 0;
      } else if (value >= activeRamp[stopsCount - 1].val) {
        norm = 1.0;
      } else {
        for (let i = 0; i < stopsCount - 1; i++) {
          const currentStop = activeRamp[i];
          const nextStop = activeRamp[i + 1];
          if (value >= currentStop.val && value <= nextStop.val) {
            const range = nextStop.val - currentStop.val;
            const t = range > 0 ? (value - currentStop.val) / range : 0;
            const virtualIndex = i + t;
            norm = virtualIndex / (stopsCount - 1);
            break;
          }
        }
      }

      const pixelValue = Math.max(0, Math.min(255, Math.round(norm * 255)));
      pixels[row * GRID_WIDTH + col] = pixelValue;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.snowTexture);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels
    );
  }

  destroy() {
    const gl = this.gl;
    if (this.snowTexture) gl.deleteTexture(this.snowTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.snowTexture = null;
    this.rampTexture = null;
  }
}
