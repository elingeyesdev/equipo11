/**
 * RainColorLayer.js — Capa WebGL nativa para Mapbox GL JS.
 *
 * Implementa CustomLayerInterface para pintar un mapa de color
 * basado en la intensidad de lluvia con interpolación bilineal manual.
 */

import mapboxgl from 'mapbox-gl';
import RainDataTexture from './RainDataTexture.js';
import { vertexSource, fragmentSource } from './shaders_rain.js';

export default class RainColorLayer {
  /**
   * @param {Object} options
   * @param {string}  options.id      — ID único de la capa (default: 'rain-color-layer')
   * @param {number}  options.opacity — Opacidad global 0-1 (default: 0.85)
   */
  constructor(options = {}) {
    this.id = options.id || 'rain-color-layer';
    this.type = 'custom';
    this.renderingMode = '2d';
    this.opacity = options.opacity ?? 0.85;

    // Estado interno
    this._program = null;
    this._buffer = null;
    this._texManager = null;
    this._pendingData = null;
  }

  // ─── CustomLayerInterface ──────────────────────────────────────

  onAdd(map, gl) {
    this._map = map;
    this._gl = gl; // Guardamos contexto para limpieza forzada

    // 1. Compilar shaders
    const vs = this._compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this._program = gl.createProgram();
    gl.attachShader(this._program, vs);
    gl.attachShader(this._program, fs);
    gl.linkProgram(this._program);

    if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
      console.error('[RainColorLayer] Program link error:', gl.getProgramInfoLog(this._program));
      return;
    }

    // 2. Ubicaciones de uniforms y atributos
    this._aPos = gl.getAttribLocation(this._program, 'a_pos');
    this._uMatrix = gl.getUniformLocation(this._program, 'u_matrix');
    this._uRainData = gl.getUniformLocation(this._program, 'u_rain_data');
    this._uColorRamp = gl.getUniformLocation(this._program, 'u_color_ramp');
    this._uOpacity = gl.getUniformLocation(this._program, 'u_opacity');
    this._uTexSize = gl.getUniformLocation(this._program, 'u_tex_size');

    // 3. Quad geográfico
    const yTop = mapboxgl.MercatorCoordinate.fromLngLat([0, 85.051]).y;
    const yBottom = mapboxgl.MercatorCoordinate.fromLngLat([0, -85.051]).y;

    const nw = { x: -5.0, y: yTop };
    const ne = { x: 6.0, y: yTop };
    const sw = { x: -5.0, y: yBottom };
    const se = { x: 6.0, y: yBottom };

    const vertices = new Float32Array([
      nw.x, nw.y,
      ne.x, ne.y,
      sw.x, sw.y,
      ne.x, ne.y,
      se.x, se.y,
      sw.x, sw.y,
    ]);

    this._buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // 4. Inicializar texturas
    this._texManager = new RainDataTexture(gl);

    if (this._pendingData) {
      this._texManager.update(this._pendingData);
      this._pendingData = null;
    }
  }

  render(gl, matrix) {
    if (!this._program || !this._texManager) return;

    gl.useProgram(this._program);

    gl.uniformMatrix4fv(this._uMatrix, false, matrix);
    gl.uniform1f(this._uOpacity, this.opacity);
    gl.uniform2f(this._uTexSize, this._texManager.gridWidth, this._texManager.gridHeight);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.rainTexture);
    gl.uniform1i(this._uRainData, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.rampTexture);
    gl.uniform1i(this._uColorRamp, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(this._aPos);
    gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  destroy() {
    const gl = this._gl;
    if (!gl) return;
    if (this._program) gl.deleteProgram(this._program);
    if (this._buffer) gl.deleteBuffer(this._buffer);
    if (this._texManager) this._texManager.destroy();

    this._program = null;
    this._buffer = null;
    this._texManager = null;
    this._gl = null;
  }

  onRemove(_map, gl) {
    this.destroy();
  }

  // ─── API Pública ───────────────────────────────────────────────

  updateData(gridData) {
    if (this._texManager) {
      this._texManager.update(gridData);
      if (this._map) this._map.triggerRepaint();
    } else {
      this._pendingData = gridData;
    }
  }

  setOpacity(value) {
    this.opacity = value;
    if (this._map) this._map.triggerRepaint();
  }

  /**
   * Cambia la paleta de colores dinámicamente (Open/Closed Principle).
   */
  setColorRamp(ramp) {
    if (this._texManager) {
      this._texManager.setColorRamp(ramp);
      if (this._map) this._map.triggerRepaint();
    }
  }

  // ─── Helpers Privados ──────────────────────────────────────────

  _compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const label = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
      console.error(`[RainColorLayer] ${label} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
}
