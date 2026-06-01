import mapboxgl from 'mapbox-gl';
import VisibilityDataTexture from './VisibilityDataTexture.js';
import { vertexSource, fragmentSource } from './shaders_visibility.js';

export default class VisibilityColorLayer {
  constructor(options = {}) {
    this.id = options.id || 'visibility-color-layer';
    this.type = 'custom';
    this.renderingMode = '2d';
    this.opacity = options.opacity ?? 0.90;

    this._program = null;
    this._buffer = null;
    this._texManager = null;
    this._pendingData = null;
  }

  onAdd(map, gl) {
    console.log("[DEBUG VISIBILITY] Capa montada, textura cargada y WebGL inicializado");
    this._map = map;
    this._gl = gl;

    const vs = this._compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this._program = gl.createProgram();
    gl.attachShader(this._program, vs);
    gl.attachShader(this._program, fs);
    gl.linkProgram(this._program);

    if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
      console.error('[VisibilityColorLayer] Program link error:', gl.getProgramInfoLog(this._program));
      return;
    }

    this._aPos = gl.getAttribLocation(this._program, 'a_pos');
    this._uMatrix = gl.getUniformLocation(this._program, 'u_matrix');
    this._uVisData = gl.getUniformLocation(this._program, 'u_vis_data');
    this._uVisDataNext = gl.getUniformLocation(this._program, 'u_vis_data_next');
    this._uColorRamp = gl.getUniformLocation(this._program, 'u_color_ramp');
    this._uOpacity = gl.getUniformLocation(this._program, 'u_opacity');
    this._uTexSize = gl.getUniformLocation(this._program, 'u_tex_size');
    this._uMixFactor = gl.getUniformLocation(this._program, 'u_mix_factor');

    // Crear quad geográfico (cubre múltiples copias del mundo en coordenadas Mercator)
    // Para soportar el scroll infinito (wrap horizontal), extendemos la geometría de -5.0 a 6.0
    const yTop = mapboxgl.MercatorCoordinate.fromLngLat([0, 85.051]).y;
    const yBottom = mapboxgl.MercatorCoordinate.fromLngLat([0, -85.051]).y;

    const nw = { x: -5.0, y: yTop };
    const ne = { x: 6.0, y: yTop };
    const sw = { x: -5.0, y: yBottom };
    const se = { x: 6.0, y: yBottom };

    // Dos triángulos: NW-NE-SW, NE-SE-SW
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

    this._texManager = new VisibilityDataTexture(gl);

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
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.visTextureCurrent);
    gl.uniform1i(this._uVisData, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.visTextureNext);
    gl.uniform1i(this._uVisDataNext, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.rampTexture);
    gl.uniform1i(this._uColorRamp, 2);

    gl.uniform1f(this._uMixFactor, this.mixFactor !== undefined ? this.mixFactor : 0.0);

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
    if (this._texManager) {
      this._texManager.update(gridData);
      this.mixFactor = 0.0;
      if (this._map) this._map.triggerRepaint();
    } else {
      this._pendingData = gridData;
    }
  }

  updateDataDual(currentData, nextData, mixFactor = 0.0) {
    if (this._texManager) {
      this._texManager.updateDual(currentData, nextData);
      this.mixFactor = mixFactor;
      if (this._map) this._map.triggerRepaint();
    }
  }

  setOpacity(value) {
    this.opacity = value;
    if (this._map) this._map.triggerRepaint();
  }

  setColorRamp(ramp) {
    if (this._texManager) {
      this._texManager.setColorRamp(ramp);
      if (this._map) this._map.triggerRepaint();
    }
  }

  _compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const label = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
      console.error(`[VisibilityColorLayer] ${label} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
}
