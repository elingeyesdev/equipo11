import mapboxgl from 'mapbox-gl';

// Bounding Box maestro inmutable para el continente de Sudamérica
const SA_TL = mapboxgl.MercatorCoordinate.fromLngLat([-85, 15]);
const SA_TR = mapboxgl.MercatorCoordinate.fromLngLat([-30, 15]);
const SA_BL = mapboxgl.MercatorCoordinate.fromLngLat([-85, -58]);
const SA_BR = mapboxgl.MercatorCoordinate.fromLngLat([-30, -58]);

// Proyección Global 1:1. Cubre el planeta Tierra entero para que el PNG calce sobre Mapbox.
const WORLD_TL = mapboxgl.MercatorCoordinate.fromLngLat([-180, 85.051129]);
const WORLD_TR = mapboxgl.MercatorCoordinate.fromLngLat([180, 85.051129]);
const WORLD_BL = mapboxgl.MercatorCoordinate.fromLngLat([-180, -85.051129]);
const WORLD_BR = mapboxgl.MercatorCoordinate.fromLngLat([180, -85.051129]);

const PLANETARY_VERTS = new Float32Array([
  WORLD_TL.x, WORLD_TL.y, WORLD_TR.x, WORLD_TR.y, WORLD_BL.x, WORLD_BL.y,
  WORLD_TR.x, WORLD_TR.y, WORLD_BR.x, WORLD_BR.y, WORLD_BL.x, WORLD_BL.y,
]);

const GW_TL = mapboxgl.MercatorCoordinate.fromLngLat([-180, 85.051129]);
const GW_TR = mapboxgl.MercatorCoordinate.fromLngLat([180, 85.051129]);
const GW_BL = mapboxgl.MercatorCoordinate.fromLngLat([-180, -85.051129]);
const GW_BR = mapboxgl.MercatorCoordinate.fromLngLat([180, -85.051129]);

const GLOBAL_WORLD_VERTS = new Float32Array([
  GW_TL.x, GW_TL.y, GW_TR.x, GW_TR.y, GW_BL.x, GW_BL.y,
  GW_TR.x, GW_TR.y, GW_BR.x, GW_BR.y, GW_BL.x, GW_BL.y,
]);

const UV_VERTS = new Float32Array([
  0.0, 0.0,  1.0, 0.0,  0.0, 1.0,
  1.0, 0.0,  1.0, 1.0,  0.0, 1.0
]);

const VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_pos;
  attribute vec2 a_uv;
  uniform mat4 u_matrix;
  varying vec2 v_uv;
  void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    // Las coordenadas UV deben mapear la textura 1:1 sobre el rectángulo de vértices
    v_uv = a_uv;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_data;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform float u_is_wind;
  varying vec2 v_uv;

  void main() {
    vec4 texel = texture2D(u_data, v_uv);
    float val = texel.r;

    if (u_is_wind > 0.5) {
      float u_norm = texel.r;
      float v_norm = texel.g;
      float u_ms = (u_norm * 200.0) - 100.0;
      float v_ms = (v_norm * 200.0) - 100.0;
      float speed_ms = sqrt(u_ms * u_ms + v_ms * v_ms);
      float speed_kmh = speed_ms * 3.6;
      val = clamp(speed_kmh / 140.0, 0.0, 1.0);
    }

    vec4 color = texture2D(u_color_ramp, vec2(val, 0.5));
    if (color.a < 0.01) { discard; }
    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;

export const COLOR_RAMPS = {
  temperatura: [
    { val: 0.0, color: [0, 0, 96, 0] },
    { val: 0.15, color: [0, 0, 255, 255] },
    { val: 0.35, color: [0, 255, 255, 255] },
    { val: 0.55, color: [0, 255, 0, 255] },
    { val: 0.75, color: [255, 255, 0, 255] },
    { val: 0.9, color: [255, 0, 0, 255] },
    { val: 1.0, color: [128, 0, 0, 255] }
  ],
  lluvia: [
    { val: 0.0, color: [0, 0, 0, 0] },
    { val: 0.05, color: [0, 255, 255, 180] },
    { val: 0.2, color: [0, 128, 255, 220] },
    { val: 0.5, color: [0, 0, 255, 255] },
    { val: 0.8, color: [255, 0, 255, 255] },
    { val: 1.0, color: [255, 255, 255, 255] }
  ],
  viento: [
    { val: 0.0, color: [255, 255, 255, 0] },
    { val: 0.1, color: [0, 255, 255, 150] },
    { val: 0.3, color: [0, 255, 0, 200] },
    { val: 0.6, color: [255, 255, 0, 255] },
    { val: 0.85, color: [255, 0, 0, 255] },
    { val: 1.0, color: [255, 0, 255, 255] }
  ],
  visibilidad: [
    { val: 0.0, color: [128, 0, 0, 255] },
    { val: 0.2, color: [255, 0, 0, 255] },
    { val: 0.4, color: [255, 255, 0, 255] },
    { val: 0.7, color: [0, 255, 0, 255] },
    { val: 1.0, color: [255, 255, 255, 0] }
  ]
};

function buildRampPixels(metric) {
  const ramp = COLOR_RAMPS[metric] || COLOR_RAMPS.temperatura;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);

  ramp.forEach(stop => {
    const [r, g, b, a] = stop.color;
    grad.addColorStop(stop.val, `rgba(${r},${g},${b},${a / 255})`);
  });

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

export function createHistoricalLayer(layerId, activeLayerRef) {
  return {
    id: layerId,
    type: 'custom',
    onAdd: function (map, gl) {
      this._map = map;
      const vertShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertShader, VERTEX_SHADER);
      gl.compileShader(vertShader);

      const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragShader, FRAGMENT_SHADER);
      gl.compileShader(fragShader);

      this._program = gl.createProgram();
      gl.attachShader(this._program, vertShader);
      gl.attachShader(this._program, fragShader);
      gl.linkProgram(this._program);

      this._aPos = gl.getAttribLocation(this._program, 'a_pos');
      this._aUv = gl.getAttribLocation(this._program, 'a_uv');
      this._uMatrix = gl.getUniformLocation(this._program, 'u_matrix');
      this._uOpacity = gl.getUniformLocation(this._program, 'u_opacity');
      this._uIsWind = gl.getUniformLocation(this._program, 'u_is_wind');
      this._uData = gl.getUniformLocation(this._program, 'u_data');
      this._uColorRamp = gl.getUniformLocation(this._program, 'u_color_ramp');

      this._buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
      gl.bufferData(gl.ARRAY_BUFFER, PLANETARY_VERTS, gl.STATIC_DRAW);

      this._uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, UV_VERTS, gl.STATIC_DRAW);

      this._texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      this._rampTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._rampTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      this._lastMetric = null;
    },
    render: function (gl, matrix) {
      const metric = activeLayerRef.current || 'temperatura';
      if (metric !== this._lastMetric) {
        const rampData = buildRampPixels(metric);
        gl.bindTexture(gl.TEXTURE_2D, this._rampTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampData);
        this._lastMetric = metric;
      }

      gl.useProgram(this._program);
      gl.uniformMatrix4fv(this._uMatrix, false, matrix);
      gl.uniform1f(this._uOpacity, 0.85);
      gl.uniform1f(this._uIsWind, metric === 'viento' ? 1.0 : 0.0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.uniform1i(this._uData, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this._rampTexture);
      gl.uniform1i(this._uColorRamp, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
      gl.enableVertexAttribArray(this._aPos);
      gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
      gl.enableVertexAttribArray(this._aUv);
      gl.vertexAttribPointer(this._aUv, 2, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    updateData: function (url, glInstance) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        if (!this._map) return;
        const gl = glInstance || this._map.painter.context.gl;
        
        const isGlobalHemisphere = (img.width / img.height) > 1.8;
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, isGlobalHemisphere ? GLOBAL_WORLD_VERTS : PLANETARY_VERTS, gl.STATIC_DRAW);

        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        this._map.triggerRepaint();
      };
      img.src = url;
    }
  };
}