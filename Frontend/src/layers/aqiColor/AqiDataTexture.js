import { buildAqiColorRampTexture } from './colorRamps_aqi.js';

const GRID_WIDTH = 360;
const GRID_HEIGHT = 181; // Ajustado a 181 para resolución GEFS
const MAX_AQI = 500;

export default class AqiDataTexture {
  constructor(gl) {
    this.gl = gl;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    // Textura de datos AQI (LUMINANCE, UNSIGNED_BYTE)
    this.dataTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Inicializar vacía
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, emptyData
    );

    // Textura de la paleta de color
    this.rampTexture = gl.createTexture();
    this._uploadRamp();
  }

  _uploadRamp() {
    const gl = this.gl;
    const pixels = buildAqiColorRampTexture();

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

  async fetchDataAndUpdate() {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/calidad-aire/global`);
      if (!response.ok) throw new Error('No se pudo descargar la malla de AQI');
      const gridData = await response.json();
      
      this.update(gridData);
      return true;
    } catch (error) {
      console.error('[AqiDataTexture] Error fetching AQI:', error);
      return false;
    }
  }

  update(gridData) {
    if (!gridData || gridData.length === 0) return;

    const gl = this.gl;
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

    for (const point of gridData) {
      const lat = Number(point.lat);
      const lon = Number(point.lon);
      const aqiValue = Number(point.aqi);

      if (isNaN(lat) || isNaN(lon) || isNaN(aqiValue) || point.aqi === null) continue;

      // Mapear coordenadas a índices (0 a 359, 0 a 180)
      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 90.0); // De -90 a +90 (0 a 180)

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      // Normalización 0-500 a byte (0-255)
      const norm = Math.min(1.0, Math.max(0.0, aqiValue / MAX_AQI));
      pixels[row * GRID_WIDTH + col] = Math.round(norm * 255);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels
    );
  }

  destroy() {
    const gl = this.gl;
    if (this.dataTexture) gl.deleteTexture(this.dataTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.dataTexture = null;
    this.rampTexture = null;
  }
}
