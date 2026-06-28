import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/mapbox';

const VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_pos;
  uniform mat4 u_matrix;
  varying vec2 v_mercator;
  void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    v_mercator = a_pos;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_data;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform float u_is_wind;
  uniform float u_lon_offset;
  varying vec2 v_mercator;
  const float PI = 3.14159265359;

  void main() {
    float wrappedX = fract(v_mercator.x);
    float lon = wrappedX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    float u = fract(((lon + 180.0) / 360.0) + u_lon_offset);
    float v = (lat + 90.0) / 180.0;

    if (v < 0.0 || v > 1.0) { discard; }

    vec4 texel = texture2D(u_data, vec2(u, v));
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

const COLOR_RAMPS = {
  visibilidad: [
    { t: 0.00, r: 150, g: 45, b: 0, a: 216 },
    { t: 0.04, r: 230, g: 90, b: 0, a: 216 },
    { t: 0.12, r: 255, g: 150, b: 50, a: 204 },
    { t: 0.41, r: 255, g: 220, b: 180, a: 153 },
    { t: 0.90, r: 255, g: 255, b: 255, a: 0 },
    { t: 1.00, r: 0, g: 0, b: 0, a: 0 },
  ],
  rayos: [
    { t: 0.00, r: 0, g: 0, b: 0, a: 0 },
    { t: 0.20, r: 0, g: 0, b: 0, a: 0 },
    { t: 0.30, r: 255, g: 255, b: 0, a: 204 },
    { t: 0.60, r: 255, g: 128, b: 0, a: 230 },
    { t: 1.00, r: 255, g: 0, b: 255, a: 255 },
  ],
  humedad: [
    { t: 0.00, r: 133, g: 68, b: 0, a: 204 },
    { t: 0.20, r: 196, g: 146, b: 63, a: 204 },
    { t: 0.40, r: 255, g: 255, b: 255, a: 204 },
    { t: 0.60, r: 65, g: 157, b: 148, a: 204 },
    { t: 0.80, r: 13, g: 100, b: 93, a: 204 },
    { t: 1.00, r: 3, g: 59, b: 54, a: 230 },
  ],
  uv: [
    { t: 0.00, r: 149, g: 231, b: 68, a: 0 },
    { t: 0.06, r: 149, g: 231, b: 68, a: 204 },
    { t: 0.20, r: 208, g: 209, b: 2, a: 204 },
    { t: 0.40, r: 243, g: 107, b: 0, a: 204 },
    { t: 0.53, r: 220, g: 0, b: 0, a: 204 },
    { t: 0.73, r: 245, g: 0, b: 140, a: 204 },
    { t: 1.00, r: 0, g: 214, b: 255, a: 230 },
  ],
  temperatura: [
    { t: 0.00, r: 50, g: 0, b: 50, a: 230 },
    { t: 0.15, r: 0, g: 0, b: 255, a: 230 },
    { t: 0.35, r: 0, g: 255, b: 255, a: 230 },
    { t: 0.55, r: 0, g: 255, b: 0, a: 230 },
    { t: 0.75, r: 255, g: 255, b: 0, a: 230 },
    { t: 0.90, r: 255, g: 0, b: 0, a: 230 },
    { t: 1.00, r: 128, g: 0, b: 0, a: 230 },
  ],
  lluvia: [
    { t: 0.00, r: 0, g: 0, b: 0, a: 0 },
    { t: 0.05, r: 0, g: 255, b: 255, a: 153 },
    { t: 0.20, r: 0, g: 128, b: 255, a: 180 },
    { t: 0.50, r: 0, g: 0, b: 255, a: 230 },
    { t: 0.80, r: 255, g: 0, b: 255, a: 230 },
    { t: 1.00, r: 255, g: 255, b: 255, a: 230 },
  ],
  viento: [
    { t: 0.00, r: 255, g: 255, b: 255, a: 0 },
    { t: 0.10, r: 0, g: 255, b: 255, a: 153 },
    { t: 0.30, r: 0, g: 255, b: 0, a: 180 },
    { t: 0.60, r: 255, g: 255, b: 0, a: 230 },
    { t: 0.85, r: 255, g: 0, b: 0, a: 230 },
    { t: 1.00, r: 255, g: 0, b: 255, a: 230 },
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
    grad.addColorStop(stop.t, \`rgba(\${stop.r},\${stop.g},\${stop.b},\${stop.a / 255})\`);
  });

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

const imageNeedsOffset = (img) => img.width <= 720;

export default function MobileAtmosphericLayer({ dateStr, metric }) {
  const { current: map } = useMap();
  const layerRef = useRef(null);
  
  useEffect(() => {
    if (!map) return;
    const mapInstance = map.getMap();
    
    if (!mapInstance.getSource('historical-source')) {
      const BASE_DATA_URL = (import.meta.env.VITE_MAP_DATA_URL || 'http://localhost:8080').replace(/\\/+$/, '');
      
      const layerId = 'mobile-atmospheric-layer';
      
      const customLayer = {
        id: layerId,
        type: 'custom',
        _extraLonOffset: 0.0,
        _lastMetric: null,
        onAdd: function (map, gl) {
          this._map = map;
          this._gl = gl;
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
          this._uMatrix = gl.getUniformLocation(this._program, 'u_matrix');
          this._uOpacity = gl.getUniformLocation(this._program, 'u_opacity');
          this._uIsWind = gl.getUniformLocation(this._program, 'u_is_wind');
          this._uData = gl.getUniformLocation(this._program, 'u_data');
          this._uColorRamp = gl.getUniformLocation(this._program, 'u_color_ramp');
          this._uLonOffset = gl.getUniformLocation(this._program, 'u_lon_offset');

          const verts = new Float32Array([
            0, 0, 1, 0, 0, 1,
            1, 0, 1, 1, 0, 1
          ]);

          this._buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
          gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

          this._dataTex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, this._dataTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

          this._rampTex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, this._rampTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

          const emptyPx = new Uint8Array([0, 0, 0, 0]);
          gl.bindTexture(gl.TEXTURE_2D, this._dataTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyPx);
        },
        render: function (gl, matrix) {
          if (!this._program) return;
          if (!this.metric) return;
          
          if (this.metric !== this._lastMetric) {
            const rampData = buildRampPixels(this.metric);
            gl.bindTexture(gl.TEXTURE_2D, this._rampTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampData);
            this._lastMetric = this.metric;
          }
          
          gl.useProgram(this._program);
          gl.uniformMatrix4fv(this._uMatrix, false, matrix);
          gl.uniform1f(this._uOpacity, 0.85);
          gl.uniform1f(this._uIsWind, this.metric === 'viento' ? 1.0 : 0.0);
          
          const isShifted = this.metric === 'evaporacion';
          const finalOffset = (isShifted || this._extraLonOffset > 0) ? 0.5 : 0.0;
          gl.uniform1f(this._uLonOffset, finalOffset);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this._dataTex);
          gl.uniform1i(this._uData, 0);

          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, this._rampTex);
          gl.uniform1i(this._uColorRamp, 1);

          gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
          gl.enableVertexAttribArray(this._aPos);
          gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      };
      
      mapInstance.addLayer(customLayer, 'waterway-label');
      layerRef.current = customLayer;
    }
    
    return () => {
      if (mapInstance.getLayer('mobile-atmospheric-layer')) {
        mapInstance.removeLayer('mobile-atmospheric-layer');
      }
    };
  }, [map]);

  // Handle data fetching
  useEffect(() => {
    if (!map || !dateStr || !metric) return;
    const mapInstance = map.getMap();
    const layer = mapInstance.getLayer('mobile-atmospheric-layer');
    if (layer && layer.implementation) {
      layer.implementation.metric = metric;
    }

    const BASE_DATA_URL = (import.meta.env.VITE_MAP_DATA_URL || 'http://localhost:8080').replace(/\\/+$/, '');
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const url = \`\${BASE_DATA_URL}/\${metric}/\${year}/\${month}/\${dateStr}.png\`;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      if (layer && layer.implementation && layer.implementation._gl) {
        const customLayer = layer.implementation;
        customLayer._extraLonOffset = imageNeedsOffset(img) ? 0.5 : 0.0;
        const gl = customLayer._gl;
        gl.bindTexture(gl.TEXTURE_2D, customLayer._dataTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        mapInstance.triggerRepaint();
      }
    };
    
    return () => { cancelled = true; img.onload = null; img.src = ''; };
  }, [map, dateStr, metric]);

  return null;
}
