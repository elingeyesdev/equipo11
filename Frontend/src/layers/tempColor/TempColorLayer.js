/**
 * TempColorLayer.js — Capa WebGL nativa para Mapbox GL JS.
 *
 * Implementa CustomLayerInterface para pintar un mapa de color
 * basado en la temperatura con interpolación bilineal.
 *
 * Arquitectura clonada de WindColorLayer.js para garantizar
 * alineación píxel-perfect y rendimiento idéntico.
 *
 * SRP: Solo renderiza. La gestión de texturas la delega a TempDataTexture.
 */

import mapboxgl from 'mapbox-gl';
import TempDataTexture from './TempDataTexture.js';
import { vertexSource, fragmentSource } from './shaders_temp.js';

export default class TempColorLayer {
  /**
   * @param {Object} options
   * @param {string}  options.id      — ID único de la capa (default: 'temp-color-layer')
   * @param {number}  options.opacity — Opacidad global 0-1 (default: 0.6)
   */
  constructor(options = {}) {
    this.id = options.id || 'temp-color-layer';
    this.type = 'custom';
    this.renderingMode = '2d';
    this.opacity = options.opacity ?? 0.6;

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
      console.error('[TempColorLayer] Program link error:', gl.getProgramInfoLog(this._program));
      return;
    }

    // 2. Ubicaciones de uniforms y atributos
    this._aPos       = gl.getAttribLocation(this._program, 'a_pos');
    this._uMatrix    = gl.getUniformLocation(this._program, 'u_matrix');
    this._uTempData  = gl.getUniformLocation(this._program, 'u_temp_data');
    this._uColorRamp = gl.getUniformLocation(this._program, 'u_color_ramp');
    this._uOpacity   = gl.getUniformLocation(this._program, 'u_opacity');
    this._uTexSize   = gl.getUniformLocation(this._program, 'u_tex_size');

    // 3. Crear quad geográfico (cubre múltiples copias del mundo en coordenadas Mercator)
    //    Para soportar el scroll infinito (wrap horizontal), extendemos la geometría de -5.0 a 6.0
    const yTop = mapboxgl.MercatorCoordinate.fromLngLat([0, 85.051]).y;
    const yBottom = mapboxgl.MercatorCoordinate.fromLngLat([0, -85.051]).y;

    const nw = { x: -5.0, y: yTop };
    const ne = { x:  6.0, y: yTop };
    const sw = { x: -5.0, y: yBottom };
    const se = { x:  6.0, y: yBottom };

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

    // 4. Inicializar texturas
    this._texManager = new TempDataTexture(gl);

    // Si ya teníamos datos pendientes, subirlos ahora
    if (this._pendingData) {
      this._texManager.update(this._pendingData);
      this._pendingData = null;
    }
  }

  render(gl, matrix) {
    if (!this._program || !this._texManager) return;

    gl.useProgram(this._program);

    // Uniform: matriz de proyección y opacidad
    gl.uniformMatrix4fv(this._uMatrix, false, matrix);
    gl.uniform1f(this._uOpacity, this.opacity);

    // Uniform: resolución del grid
    gl.uniform2f(this._uTexSize, this._texManager.gridWidth, this._texManager.gridHeight);

    // Textura 0: datos de temperatura
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.tempTexture);
    gl.uniform1i(this._uTempData, 0);

    // Textura 1: paleta de color
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.rampTexture);
    gl.uniform1i(this._uColorRamp, 1);

    // Buffer de vértices
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(this._aPos);
    gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

    // Blending para transparencia
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

  /**
   * Actualiza la textura de datos con nuevos datos del radar.
   * @param {Array} gridData — Array de { latitud, longitud, temp/temperatura }
   */
  updateData(gridData) {
    if (this._texManager) {
      this._texManager.update(gridData);
      if (this._map) this._map.triggerRepaint();
    } else {
      // onAdd aún no fue llamado; guardar para después
      this._pendingData = gridData;
    }
  }

  /**
   * Cambia la opacidad sin recompilar shaders.
   */
  setOpacity(value) {
    this.opacity = value;
    if (this._map) this._map.triggerRepaint();
  }

  // ─── Helpers Privados ──────────────────────────────────────────

  _compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const label = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
      console.error(`[TempColorLayer] ${label} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
}

// ─── Funciones de Gestión de Capa ────────────────────────────────────

export function addTempLayers(map, customLayer, data) {
  if (data) {
    customLayer.updateData(data);
  }

  if (!map.getLayer(customLayer.id)) {
    // Buscar la capa óptima para insertar debajo de etiquetas y fronteras
    let beforeId = null;
    const style = map.getStyle();
    if (style && style.layers) {
      for (const layer of style.layers) {
        if (layer.type === 'symbol' || (layer.id && (layer.id.includes('boundary') || layer.id.includes('label')))) {
          beforeId = layer.id;
          break;
        }
      }
    }

    // Fallback por si acaso
    if (!beforeId) {
      beforeId = map.getLayer('waterway-label') ? 'waterway-label' :
                 (map.getLayer('place-label') ? 'place-label' : null);
    }

    if (beforeId) {
      map.addLayer(customLayer, beforeId);
    } else {
      map.addLayer(customLayer);
    }
  }
}

export function removeTempLayers(map) {
  if (map.getLayer('temp-color-layer')) {
    map.removeLayer('temp-color-layer');
  }
}
