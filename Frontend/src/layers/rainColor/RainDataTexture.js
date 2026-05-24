/**
 * RainDataTexture.js — Gestor de texturas WebGL para datos de lluvia de la NOAA.
 *
 * SRP: Se ocupa de codificar datos escalares del grid en textura GPU.
 *  - Textura 2D de intensidad de lluvia (360x180, LUMINANCE)
 */

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MAX_RAIN = 50.0; // mm/h esperado para lluvia intensa/tormenta

export default class RainDataTexture {
  /**
   * @param {WebGLRenderingContext} gl
   */
  constructor(gl) {
    this.gl = gl;
    this.maxRain = MAX_RAIN;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    // --- Textura de datos de lluvia (360x180, LUMINANCE, UNSIGNED_BYTE) ---
    this.rainTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);

    // NEAREST y CLAMP_TO_EDGE estrictamente requeridos.
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
  }

  /**
   * Actualiza la textura de datos con el grid de lluvia.
   * @param {Array} gridData — Array de { latitud, longitud, rain }
   */
  update(gridData) {
    if (!gridData || gridData.length === 0) return;

    // PRUEBA DE VALIDACIÓN:
    const maxRainVal = Math.max(...gridData.map(p => p.rain || 0));
    console.log("🔍 MAX LLUVIA EN GRID:", maxRainVal);

    const gl = this.gl;
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

    for (const point of gridData) {
      const lat = Number(point.latitud);
      const lon = Number(point.longitud);

      if (isNaN(lat) || isNaN(lon)) continue;

      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      // INYECCIÓN DE PRUEBA: Generar un patrón matemático de lluvia en el frontend
      // Esto pintará franjas verticales de lluvia independientemente del backend
      // const rain = Number(point.rain) || 0; // Original
      const rain = (col % 20 === 0) ? 25.0 : 0.0;

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      // Normalizar intensidad de lluvia a [0, 255]
      const pixelValue = Math.max(0, Math.min(255, Math.round((rain / this.maxRain) * 255)));
      pixels[row * GRID_WIDTH + col] = pixelValue;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels
    );
  }

  /**
   * Libera recursos GPU.
   */
  destroy() {
    const gl = this.gl;
    if (this.rainTexture) gl.deleteTexture(this.rainTexture);
    this.rainTexture = null;
  }
}
