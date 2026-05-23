/**
 * WindDataTexture.js — Gestor de texturas WebGL para datos NOAA.
 *
 * SRP: Solo se ocupa de codificar datos del grid en texturas GPU.
 *  - Textura 2D de velocidades (360×180, equirectangular, LUMINANCE)
 *  - Textura 1D de paleta de color (256×1, RGBA)
 */

import { buildColorRampTexture, DEFAULT_RAMP } from './colorRamps.js';

// Constantes del grid global (1° resolución, centros en ±0.5)
const GRID_WIDTH  = 360;
const GRID_HEIGHT = 180;
const MAX_SPEED   = 150; // km/h — para normalizar a [0, 1]

export default class WindDataTexture {
  /**
   * @param {WebGLRenderingContext} gl
   * @param {Array} colorRamp — paleta de colores (default: BEAUFORT)
   */
  constructor(gl, colorRamp = DEFAULT_RAMP) {
    this.gl = gl;
    this.maxSpeed = MAX_SPEED;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;
    // --- Textura de datos de viento (360×180, LUMINANCE, UNSIGNED_BYTE) ---
    this.windTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture);

    // Forzamos NEAREST y CLAMP_TO_EDGE (KISS). 
    // La interpolación bilineal con wrap del antimeridiano se hace SIEMPRE en el shader.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Inicializar con ceros
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, emptyData
    );

    // --- Textura de paleta de color (256×1, RGBA) ---
    this.rampTexture = gl.createTexture();
    this._uploadRamp(colorRamp);
  }

  /**
   * Sube la paleta de color a la GPU.
   * @param {Array} ramp
   */
  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildColorRampTexture(ramp, this.maxSpeed);

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
   * Actualiza la textura de datos con el grid de radar actual.
   * @param {Array} gridData — Array de { latitud, longitud, wind_speed, ... }
   */
  update(gridData) {
    if (!gridData || gridData.length === 0) return;

    const gl = this.gl;
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

    for (const point of gridData) {
      // PostgreSQL devuelve DECIMAL como string — parsear explícitamente
      const lat = Number(point.latitud);
      const lon = Number(point.longitud);
      const speed = Number(point.wind_speed) || 0;

      if (isNaN(lat) || isNaN(lon)) continue;

      // Mapear coordenadas geográficas a índices de textura
      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      // Normalizar velocidad a [0, 255]
      const norm = Math.min(speed / this.maxSpeed, 1.0);
      pixels[row * GRID_WIDTH + col] = Math.round(norm * 255);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels
    );
  }

  /**
   * Cambia la paleta de colores dinámicamente (OCP).
   * @param {Array} ramp
   */
  setColorRamp(ramp) {
    this._uploadRamp(ramp);
  }

  /**
   * Libera recursos GPU.
   */
  destroy() {
    const gl = this.gl;
    if (this.windTexture) gl.deleteTexture(this.windTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.windTexture = null;
    this.rampTexture = null;
  }
}
