import mapboxgl from 'mapbox-gl';
import SnowDataTexture from './SnowDataTexture.js';
import { vertexSource, fragmentSource } from './shaders_snow.js';

export default class SnowColorLayer {
  constructor(options = {}) {
    this.id = options.id || 'snow-color-layer';
    this.type = 'custom';
    this.renderingMode = '2d';
    this.opacity = options.opacity ?? 0.90;
    this.snowType = options.snowType ?? 0;

    this._program = null;
    this._buffer = null;
    this._texManager = null;
    this._pendingData = null;
    this._lastData = null;
  }

  onAdd(map, gl) {
    this._map = map;
    this._gl = gl;

    const vs = this._compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this._program = gl.createProgram();
    gl.attachShader(this._program, vs);
    gl.attachShader(this._program, fs);
    gl.linkProgram(this._program);

    if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
      console.error('[SnowColorLayer] Program link error:', gl.getProgramInfoLog(this._program));
      return;
    }

    this._aPos = gl.getAttribLocation(this._program, 'a_pos');
    this._uMatrix = gl.getUniformLocation(this._program, 'u_matrix');
    this._uSnowData = gl.getUniformLocation(this._program, 'u_snow_data');
    this._uSnowDataNext = gl.getUniformLocation(this._program, 'u_snow_data_next');
    this._uColorRamp = gl.getUniformLocation(this._program, 'u_color_ramp');
    this._uOpacity = gl.getUniformLocation(this._program, 'u_opacity');
    this._uTexSize = gl.getUniformLocation(this._program, 'u_tex_size');
    this._uMixFactor = gl.getUniformLocation(this._program, 'u_mix_factor');
    this._uSnowType = gl.getUniformLocation(this._program, 'u_snow_type');

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

    this._texManager = new SnowDataTexture(gl);

    // Rescate de la sala de espera
    if (this._pendingData) {
      if (this._pendingData.current !== undefined) {
        // Es un objeto dual
        this._texManager.updateDual(this._pendingData.current, this._pendingData.next, this.snowType);
        this.mixFactor = this._pendingData.mix;
        this._lastData = this._pendingData.current;
      } else {
        // Es data antigua/fallback
        this._texManager.update(this._pendingData, this.snowType);
        this._lastData = this._pendingData;
      }
      this._pendingData = null;
      if (this._map) this._map.triggerRepaint();
    }
  }

  render(gl, matrix) {
    if (!this._program || !this._texManager) return;

    this._texManager.uploadPendingTextures();

    gl.useProgram(this._program);

    gl.uniformMatrix4fv(this._uMatrix, false, matrix);
    gl.uniform1f(this._uOpacity, this.opacity);
    gl.uniform2f(this._uTexSize, this._texManager.gridWidth, this._texManager.gridHeight);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.snowTextureCurrent);
    gl.uniform1i(this._uSnowData, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.snowTextureNext);
    gl.uniform1i(this._uSnowDataNext, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.rampTexture);
    gl.uniform1i(this._uColorRamp, 2);

    gl.uniform1f(this._uMixFactor, this.mixFactor !== undefined ? this.mixFactor : 0.0);
    gl.uniform1f(this._uSnowType, this.snowType !== undefined ? this.snowType : 0.0);

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

  updateData(gridData) {
    this._lastData = gridData;
    if (this._texManager) {
      this._texManager.update(gridData, this.snowType);
      this.mixFactor = 0.0;
      if (this._map) this._map.triggerRepaint();
    } else {
      // SALA DE ESPERA: Rescate para cuando se enciende el toggle y el mapa no está listo
      this._pendingData = gridData;
    }
  }

  updateDataDual(currentData, nextData, mixFactor = 0.0) {
    this._lastData = currentData;
    if (this._texManager) {
      this._texManager.updateDual(currentData, nextData, this.snowType);
      this.mixFactor = mixFactor;
      if (this._map) this._map.triggerRepaint();
    } else {
      // SALA DE ESPERA: Si el mapa aún no inicializa el manager, guardamos el frame
      this._pendingData = { current: currentData, next: nextData, mix: mixFactor };
    }
  }

  setOpacity(value) {
    this.opacity = value;
    if (this._map) this._map.triggerRepaint();
  }

  setSnowType(type) {
    if (this.snowType !== type) {
      this.snowType = type;
      if (this._texManager && this._lastData) {
        this._texManager.update(this._lastData, this.snowType);
      }
      if (this._map) this._map.triggerRepaint();
    }
  }

  _compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const label = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
      console.error(`[SnowColorLayer] ${label} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
}
