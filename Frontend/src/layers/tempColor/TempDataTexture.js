/**
 * TempDataTexture.js — Gestor de texturas WebGL para datos de temperatura global.
 */

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;

// Paleta de Colores de Temperatura
export const TEMP_COLOR_STOPS = [
  { val: -70.0, color: [255, 255, 255, 255] },   // Blanco / Frío extremo
  { val: -50.0, color: [150, 0, 150, 255] },     // Violeta oscuro
  { val: -30.0, color: [0, 0, 255, 255] },       // Azul oscuro
  { val: -10.0, color: [0, 255, 255, 255] },     // Cian
  { val: 0.0, color: [0, 255, 0, 255] },       // Verde (Congelación)
  { val: 15.0, color: [255, 255, 0, 255] },     // Amarillo
  { val: 30.0, color: [255, 128, 0, 255] },     // Naranja
  { val: 40.0, color: [255, 0, 0, 255] },       // Rojo
  { val: 50.0, color: [150, 0, 0, 255] }        // Granate / Calor extremo
];

function buildTempColorRampTexture(stops) {
  const size = 1024;
  const pixels = new Uint8Array(size * 4);
  const minTemp = -70.0;
  const maxTemp = 50.0;
  const rangeTotal = maxTemp - minTemp; // 120

  const sortedStops = [...stops].sort((a, b) => a.val - b.val);

  for (let i = 0; i < size; i++) {
    const val = minTemp + (i / (size - 1)) * rangeTotal;

    if (val <= sortedStops[0].val) {
      const c = sortedStops[0].color;
      pixels[i * 4 + 0] = c[0];
      pixels[i * 4 + 1] = c[1];
      pixels[i * 4 + 2] = c[2];
      pixels[i * 4 + 3] = c[3];
      continue;
    }

    if (val >= sortedStops[sortedStops.length - 1].val) {
      const c = sortedStops[sortedStops.length - 1].color;
      pixels[i * 4 + 0] = c[0];
      pixels[i * 4 + 1] = c[1];
      pixels[i * 4 + 2] = c[2];
      pixels[i * 4 + 3] = c[3];
      continue;
    }

    for (let j = 0; j < sortedStops.length - 1; j++) {
      const currentStop = sortedStops[j];
      const nextStop = sortedStops[j + 1];

      if (val >= currentStop.val && val <= nextStop.val) {
        const range = nextStop.val - currentStop.val;
        const t = range > 0 ? (val - currentStop.val) / range : 0;

        const c1 = currentStop.color;
        const c2 = nextStop.color;

        pixels[i * 4 + 0] = c1[0] + (c2[0] - c1[0]) * t;
        pixels[i * 4 + 1] = c1[1] + (c2[1] - c1[1]) * t;
        pixels[i * 4 + 2] = c1[2] + (c2[2] - c1[2]) * t;
        pixels[i * 4 + 3] = c1[3] + (c2[3] - c1[3]) * t;
        break;
      }
    }
  }

  return pixels;
}

export default class TempDataTexture {
  constructor(gl) {
    this.gl = gl;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    this.tempTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, emptyData
    );

    this.rampTexture = gl.createTexture();
    this._uploadRamp(TEMP_COLOR_STOPS);
  }

  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildTempColorRampTexture(ramp);

    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      1024, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, pixels
    );
  }

  update(gridData) {
    if (!gridData || gridData.length === 0) return;

    const gl = this.gl;
    const pixels = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);

    for (const point of gridData) {
      const lat = Number(point.latitud !== undefined ? point.latitud : point.lat);
      const lon = Number(point.longitud !== undefined ? point.longitud : point.lon);

      if (isNaN(lat) || isNaN(lon)) continue;

      const col = Math.round(lon + 179.5);
      const row = Math.round(lat + 89.5);

      const tempKelvin = point.temp !== undefined ? parseFloat(point.temp) : (point.temperatura !== undefined ? parseFloat(point.temperatura) : parseFloat(point.val));

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      const pxIndex = (row * GRID_WIDTH + col) * 4;
      if (tempKelvin === null || isNaN(tempKelvin) || tempKelvin === 0) {
        // Transparencia total si no hay dato
        pixels[pxIndex + 0] = 0;
        pixels[pxIndex + 1] = 0;
        pixels[pxIndex + 2] = 0;
        pixels[pxIndex + 3] = 0;
      } else {
        // Conversión y mapeo
        const tempC = tempKelvin - 273.15;
        const pixelValue = Math.max(0, Math.min(255, Math.round(((tempC - (-70.0)) / 120.0) * 255)));
        pixels[pxIndex + 0] = pixelValue;
        pixels[pxIndex + 1] = 0;
        pixels[pxIndex + 2] = 0;
        pixels[pxIndex + 3] = 255;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture);

    // Sonda Forense
    const debugArray = new Uint8Array(pixels.buffer);
    console.log("🔍 [Forensic Debug] Muestra de Píxeles (Primeros 20):", debugArray.slice(0, 20));
    console.log("🔍 [Forensic Debug] Valor máx en canal R:", Math.max(...pixels.filter((_, i) => i % 4 === 0)));
    console.log("🔍 [Forensic Debug] ¿Es la textura nula?", !this.tempTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID_WIDTH, GRID_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // PARÁMETROS OBLIGATORIOS PARA RESOLUCIONES NPOT (ej. 360x180)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  destroy() {
    const gl = this.gl;
    if (this.tempTexture) gl.deleteTexture(this.tempTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.tempTexture = null;
    this.rampTexture = null;
  }
}
