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

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, emptyData
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

  update(gridData) {
    if (!gridData || gridData.length === 0) return;

    const gl = this.gl;
    // Empaquetamos a 1 solo byte por píxel
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    const stops = this.colorRamp;
    const stopsCount = stops.length;

    for (const point of gridData) {
      const lat = Number(point.latitud !== undefined ? point.latitud : point.lat);
      const lon = Number(point.longitud !== undefined ? point.longitud : point.lon);

      if (isNaN(lat) || isNaN(lon)) continue;

      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      let vis = Number(point.vis !== undefined ? point.vis : 24000);
      if (isNaN(vis) || vis < 0) vis = 24000;
      
      // Convertir metros a km si viene en metros (asumiendo km por los topes)
      // Si la API lo manda en metros (24000 = 24km), lo convertimos.
      // Basado en que el valor por defecto era 24000, asumimos que viene en metros.
      // Pero los topes son 0.1, 0.5, etc (km). Así que dividimos por 1000.
      const visKm = vis > 1000 || vis === 24000 ? vis / 1000.0 : vis;

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      let norm = 0;
      if (visKm <= stops[0].val) {
        norm = 0;
      } else if (visKm >= stops[stopsCount - 1].val) {
        norm = 1.0;
      } else {
        // Interpolar índice
        for (let i = 0; i < stopsCount - 1; i++) {
          const currentStop = stops[i];
          const nextStop = stops[i + 1];
          if (visKm >= currentStop.val && visKm <= nextStop.val) {
            const range = nextStop.val - currentStop.val;
            const t = range > 0 ? (visKm - currentStop.val) / range : 0;
            const virtualIndex = i + t;
            norm = virtualIndex / (stopsCount - 1);
            break;
          }
        }
      }

      const pixelValue = Math.max(0, Math.min(255, Math.round(norm * 255)));
      pixels[row * GRID_WIDTH + col] = pixelValue;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.visTexture);
    
    // Forzamos gl.LINEAR para la interpolación fluida nativa
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels
    );
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
