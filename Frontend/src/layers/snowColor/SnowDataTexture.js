const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;
const MAX_SNOW = 150.0;

export const SNOW_RAMP = [
  { min: 0.0, max: 0.2, color: [0, 0, 0, 0] },             // Transparente
  { min: 0.2, max: 1.0, color: [150, 255, 150, 128] },     // Verde muy claro
  { min: 1.0, max: 5.0, color: [0, 200, 0, 160] },         // Verde oscuro
  { min: 5.0, max: 20.0, color: [255, 200, 0, 200] },      // Amarillo
  { min: 20.0, max: 40.0, color: [200, 100, 0, 230] },     // Naranja oscuro
  { min: 40.0, max: 70.0, color: [255, 150, 255, 255] },   // Rosa claro / Lila
  { min: 70.0, max: 100.0, color: [150, 50, 200, 255] },   // Púrpura
  { min: 100.0, max: 999.0, color: [50, 0, 100, 255] }     // Púrpura oscuro
];

function buildSnowColorRampTexture(ramp, maxSnow) {
  const size = 1024;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const snow = (i / (size - 1)) * maxSnow;
    let targetColor = ramp[ramp.length - 1].color; 

    for (let j = 0; j < ramp.length; j++) {
      if (snow >= ramp[j].min && (snow < ramp[j].max || j === ramp.length - 1)) {
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

export default class SnowDataTexture {
  constructor(gl) {
    this.gl = gl;
    this.maxSnow = MAX_SNOW;
    this.gridWidth = GRID_WIDTH;
    this.gridHeight = GRID_HEIGHT;

    this.snowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.snowTexture);

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
    this._uploadRamp(SNOW_RAMP);
  }

  _uploadRamp(ramp) {
    const gl = this.gl;
    const pixels = buildSnowColorRampTexture(ramp, this.maxSnow);

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

      let snow = Number(point.snow !== undefined ? point.snow : 0);
      if (isNaN(snow) || snow < 0) snow = 0;

      let snowFresh = Number(point.snow_fresh !== undefined ? point.snow_fresh : 0);
      if (isNaN(snowFresh) || snowFresh < 0) snowFresh = 0;

      if (col < 0 || col >= GRID_WIDTH || row < 0 || row >= GRID_HEIGHT) continue;

      const pixelValueDepth = Math.max(0, Math.min(255, Math.round((snow / this.maxSnow) * 255)));
      const pixelValueFresh = Math.max(0, Math.min(255, Math.round((snowFresh / this.maxSnow) * 255)));
      
      const index = (row * GRID_WIDTH + col) * 4;
      pixels[index] = pixelValueDepth;
      pixels[index + 1] = pixelValueFresh;
      pixels[index + 2] = 0;
      pixels[index + 3] = 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.snowTexture);
    
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      GRID_WIDTH, GRID_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, pixels
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
