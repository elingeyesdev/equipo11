const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MAX_VISIBILITY = 24000.0;

function buildVisibilityColorRampTexture(maxVis) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 1024, 0);

  // Calculando offsets basados en 24km máximo (Meteored Palette):
  gradient.addColorStop(0.00, "rgba(128, 32, 0, 1.0)");    // 0 km: Marrón muy oscuro
  gradient.addColorStop(0.02, "rgba(180, 60, 0, 1.0)");    // ~0.5 km: Marrón anaranjado
  gradient.addColorStop(0.04, "rgba(220, 100, 0, 1.0)");   // ~1 km: Naranja fuerte
  gradient.addColorStop(0.08, "rgba(240, 140, 40, 0.9)");  // ~2 km: Naranja claro
  gradient.addColorStop(0.12, "rgba(245, 180, 100, 0.8)"); // ~3 km: Naranja pálido / Ocre
  gradient.addColorStop(0.20, "rgba(250, 210, 160, 0.7)"); // ~5 km: Beige oscuro
  gradient.addColorStop(0.41, "rgba(255, 240, 220, 0.5)"); // ~10 km: Beige claro / Crema
  gradient.addColorStop(0.83, "rgba(255, 255, 255, 0.0)"); // ~20 km: Transparente
  gradient.addColorStop(1.00, "rgba(255, 255, 255, 0.0)"); // 24+ km: Transparente absoluto

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1);

  const imageData = ctx.getImageData(0, 0, 1024, 1);
  return new Uint8Array(imageData.data.buffer);
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const emptyData = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * 4);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, emptyData
    );

    this.rampTexture = gl.createTexture();
    this._uploadRamp();
  }

  _uploadRamp() {
    const gl = this.gl;
    const pixels = buildVisibilityColorRampTexture(this.maxVis);

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
    // Forzamos NEAREST (KISS). 
    // La interpolación bilineal perfecta (con antimeridiano) se hace SIEMPRE en el shader mediante sampleBilinear()
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

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
