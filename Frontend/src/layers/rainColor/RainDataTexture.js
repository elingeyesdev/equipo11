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

    // --- Textura de datos de lluvia (360x180, LUMINANCE, UNSIGNED_BYTE) ---
    this.rainTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Inicializar con ceros (1 canal por píxel: LUMINANCE)
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, emptyData
    );

    // --- Textura de paleta de color (256×1, RGBA) ---
    this.rampTexture = gl.createTexture();
    this._uploadRamp(this.colorRamp);
  }

  /**
   * Sube la paleta de color a la GPU.
   */
  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildRainColorRampTexture(ramp);

    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Cambiamos a LINEAR para maximizar la suavidad del LERP
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      256, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, pixels
    );
  }

  /**
   * Actualiza la textura de datos con el grid de lluvia.
   * @param {Array} gridData — Array de { latitud, longitud, rain }
   */
  update(gridData) {
    if (!gridData || gridData.length === 0) return;

    const gl = this.gl;
    // LUMINANCE = 1 byte por píxel
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    const stops = this.colorRamp;
    const stopsCount = stops.length;

    for (const point of gridData) {
      const lat = Number(point.latitud !== undefined ? point.latitud : point.lat);
      const lon = Number(point.longitud !== undefined ? point.longitud : point.lon);

      if (isNaN(lat) || isNaN(lon)) continue;

      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      let rain = Number(point.rain !== undefined ? point.rain : (point.value !== undefined ? point.value : point.val));
      if (isNaN(rain) || rain < 0) rain = 0;

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      // Calcular norm [0.0 - 1.0] basado en interpolación por índices
      let norm = 0;
      if (rain <= stops[0].val) {
        norm = 0;
      } else if (rain >= stops[stopsCount - 1].val) {
        norm = 1.0;
      } else {
        // Encontrar entre qué stops cae
        for (let i = 0; i < stopsCount - 1; i++) {
          const currentStop = stops[i];
          const nextStop = stops[i + 1];
          if (rain >= currentStop.val && rain <= nextStop.val) {
            const range = nextStop.val - currentStop.val;
            const t = range > 0 ? (rain - currentStop.val) / range : 0;
            // Índice fraccional
            const virtualIndex = i + t;
            norm = virtualIndex / (stopsCount - 1);
            break;
          }
        }
      }

      const pixelValue = Math.max(0, Math.min(255, Math.round(norm * 255)));

      // Empaquetado LUMINANCE (1 byte per pixel)
      const index = (row * GRID_WIDTH + col);
      pixels[index] = pixelValue;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);

    // Fuerza Interpolación Lineal estrictamente
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Subida estricta usando gl.LUMINANCE
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

  /**
   * Libera recursos GPU.
   */
  destroy() {
    const gl = this.gl;
    if (this.rainTexture) gl.deleteTexture(this.rainTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.rainTexture = null;
    this.rampTexture = null;
  }
}
