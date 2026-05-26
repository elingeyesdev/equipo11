const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MAX_VISIBILITY = 24000.0;

export const VISIBILITY_RAMP = [
  { min: 0.0, max: 100.0, color: [130, 40, 0, 255] },        // Marrón muy oscuro (< 0.1 km)
  { min: 100.0, max: 500.0, color: [190, 70, 0, 255] },      // Marrón anaranjado (0.1 - 0.5 km)
  { min: 500.0, max: 1000.0, color: [230, 110, 20, 255] },   // Naranja fuerte (0.5 - 1.0 km)
  { min: 1000.0, max: 2000.0, color: [245, 150, 50, 255] },  // Naranja medio (1.0 - 2.0 km)
  { min: 2000.0, max: 3000.0, color: [250, 180, 100, 255] }, // Naranja claro (2.0 - 3.0 km)
  { min: 3000.0, max: 5000.0, color: [240, 200, 150, 230] }, // Melocotón/Beige oscuro (3.0 - 5.0 km)
  { min: 5000.0, max: 10000.0, color: [230, 220, 200, 180] },// Beige claro (5.0 - 10.0 km)
  { min: 10000.0, max: 20000.0, color: [220, 220, 220, 100] },// Blanco bruma casi transparente (10.0 - 20.0 km)
  { min: 20000.0, max: 99999.0, color: [0, 0, 0, 0] }        // Transparente (> 20.0 km)
];

function buildVisibilityColorRampTexture(ramp, maxVis) {
  const size = 1024;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const vis = (i / (size - 1)) * maxVis;
    let targetColor = ramp[ramp.length - 1].color;

    for (let j = 0; j < ramp.length; j++) {
      if (vis >= ramp[j].min && (vis < ramp[j].max || j === ramp.length - 1)) {
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

export default class VisibilityDataTexture {
  constructor(gl) {
    this.gl = gl;
    this.maxVis = MAX_VISIBILITY;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    this.visTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.visTexture);

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

    this.rampTexture = gl.createTexture();
    this._uploadRamp(VISIBILITY_RAMP);
  }

  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildVisibilityColorRampTexture(ramp, this.maxVis);

    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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

      let vis = Number(point.vis !== undefined ? point.vis : 24000);
      if (isNaN(vis) || vis < 0) vis = 24000;

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      const pixelValue = Math.max(0, Math.min(255, Math.round((vis / this.maxVis) * 255)));

      const index = (row * GRID_WIDTH + col) * 4;
      pixels[index] = pixelValue;
      pixels[index + 1] = 0;
      pixels[index + 2] = 0;
      pixels[index + 3] = 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.visTexture);

    // CONFIGURACIÓN CRÍTICA PARA EL SUAVIZADO:
    // Usar Interpolación Lineal cuando el mapa se acerca (Magnificación)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Usar Interpolación Lineal cuando el mapa se aleja (Minificación)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    // Opcional pero recomendado para evitar artefactos en los bordes
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, pixels
    );
  }

  destroy() {
    const gl = this.gl;
    if (this.visTexture) gl.deleteTexture(this.visTexture);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    this.visTexture = null;
    this.rampTexture = null;
  }
}
