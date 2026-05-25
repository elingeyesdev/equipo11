/**
 * RainDataTexture.js — Gestor de texturas WebGL para datos de lluvia de la NOAA.
 *
 * SRP: Se ocupa de codificar datos escalares del grid en textura GPU.
 *  - Textura 2D de intensidad de lluvia (360x180, LUMINANCE)
 */

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MAX_RAIN = 50.0; // mm/h esperado para lluvia intensa/tormenta

// --- Paleta Forense Estilo Meteored (Escalones Discretos) ---
export const METEORED_RAMP = [
  { min: 0.0, max: 0.2, color: [0, 0, 0, 0] },         // Transparente
  { min: 0.2, max: 1.0, color: [100, 220, 255, 128] }, // Celeste suave
  { min: 1.0, max: 3.0, color: [0, 150, 255, 160] },   // Azul medio
  { min: 3.0, max: 5.0, color: [0, 50, 200, 200] },    // Azul oscuro
  { min: 5.0, max: 10.0, color: [150, 0, 200, 230] },  // Púrpura
  { min: 10.0, max: 20.0, color: [200, 0, 150, 255] }, // Magenta/Rosa
  { min: 20.0, max: 50.0, color: [255, 100, 100, 255] },// Rosa claro/Rojo
  { min: 50.0, max: 999.0, color: [150, 0, 0, 255] }    // Rojo oscuro/Granate
];

function buildRainColorRampTexture(ramp, maxRain) {
  // Aumentamos a 1024 píxeles para tener súper precisión en valores < 1mm
  // 50 mm / 1024 = ~0.048 mm por píxel (resolución más que suficiente para el umbral de 0.2mm)
  const size = 1024;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const rain = (i / (size - 1)) * maxRain;

    let targetColor = ramp[ramp.length - 1].color; // Default al máximo

    for (let j = 0; j < ramp.length; j++) {
      if (rain >= ramp[j].min && (rain < ramp[j].max || j === ramp.length - 1)) {
        targetColor = ramp[j].color;
        break;
      }
    }

    pixels[i * 4 + 0] = targetColor[0];
    pixels[i * 4 + 1] = targetColor[1];
    pixels[i * 4 + 2] = targetColor[2];
    pixels[i * 4 + 3] = targetColor[3];
  }

  return pixels;
}

export default class RainDataTexture {
  /**
   * @param {WebGLRenderingContext} gl
   */
  constructor(gl) {
    this.gl = gl;
    this.maxRain = MAX_RAIN;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    // --- Textura de datos de lluvia (360x180, RGBA, UNSIGNED_BYTE) ---
    this.rainTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);

    // Forzar LINEAR explícitamente para habilitar interpolación suave (Anti-Puntillismo)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Inicializar con ceros (4 canales por pixel: R, G, B, A)
    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, emptyData
    );

    // --- Textura de paleta de color (256×1, RGBA) ---
    this.rampTexture = gl.createTexture();
    this._uploadRamp(METEORED_RAMP);
  }

  /**
   * Sube la paleta de color a la GPU.
   */
  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildRainColorRampTexture(ramp, this.maxRain);

    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Usamos NEAREST para mantener los escalones discretos duros y no difuminarlos
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      1024, 1, 0,
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
    // Buffer RGBA seguro (Width * Height * 4 bytes) para evitar Texture Stride mismatch
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);

    for (const point of gridData) {
      // Extracción dinámica de Latitud y Longitud
      const lat = Number(point.latitud !== undefined ? point.latitud : point.lat);
      const lon = Number(point.longitud !== undefined ? point.longitud : point.lon);

      if (isNaN(lat) || isNaN(lon)) continue;

      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      // Extracción dinámica del valor de la lluvia (KISS)
      let rain = Number(point.rain !== undefined ? point.rain : (point.value !== undefined ? point.value : point.val));
      if (isNaN(rain) || rain < 0) rain = 0;

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      // Normalizar intensidad de lluvia a [0, 255]
      const pixelValue = Math.max(0, Math.min(255, Math.round((rain / this.maxRain) * 255)));
      
      // Empaquetado RGBA (Stride = 4)
      const index = (row * GRID_WIDTH + col) * 4;
      pixels[index] = pixelValue;     // R: Canal activo (Intensidad Lluvia)
      pixels[index + 1] = 0;          // G: Vacío
      pixels[index + 2] = 0;          // B: Vacío
      pixels[index + 3] = 255;        // A: Alpha en 1.0 (opaco)
    }

    gl.bindTexture(gl.TEXTURE_2D, this.rainTexture);
    
    // Subida estricta usando gl.RGBA
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, pixels
    );
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
