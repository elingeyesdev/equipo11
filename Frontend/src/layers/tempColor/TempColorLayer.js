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
import { compileShader, createMercatorQuad } from '../glUtils.js';
import { findOptimalInsertionPoint } from '../windColor/layerManager.js';

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
    this.opacity = options.opacity ?? 0.90;

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
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource, 'TempColorLayer');
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, 'TempColorLayer');
    this._program = gl.createProgram();
    gl.attachShader(this._program, vs);
    gl.attachShader(this._program, fs);
    gl.linkProgram(this._program);

    if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
      console.error('[TempColorLayer] Program link error:', gl.getProgramInfoLog(this._program));
      return;
    }

    // 2. Ubicaciones de uniforms y atributos
    this._aPos         = gl.getAttribLocation(this._program, 'a_pos');
    this._uMatrix      = gl.getUniformLocation(this._program, 'u_matrix');
    this._uDataCurrent = gl.getUniformLocation(this._program, 'u_data_current');
    this._uDataNext    = gl.getUniformLocation(this._program, 'u_data_next');
    this._uColorRamp   = gl.getUniformLocation(this._program, 'u_color_ramp');
    this._uOpacity     = gl.getUniformLocation(this._program, 'u_opacity');
    this._uMixFactor   = gl.getUniformLocation(this._program, 'u_mix_factor');
    this._uTexSize     = gl.getUniformLocation(this._program, 'u_tex_size');

    // 3. Crear quad geográfico
    const vertices = createMercatorQuad(map);

    this._buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // 4. Inicializar texturas
    this._texManager = new TempDataTexture(gl);

    // Rescate de la sala de espera
    if (this._pendingData) {
      if (this._pendingData.current !== undefined) {
        // Es un objeto dual
        this._texManager.updateDual(this._pendingData.current, this._pendingData.next);
        this.mixFactor = this._pendingData.mix;
      } else {
        // Es data antigua/fallback
        this._texManager.update(this._pendingData);
      }
      this._pendingData = null;
      if (this._map) this._map.triggerRepaint();
    }
  }

  render(gl, matrix) {
    if (!this._program || !this._texManager) return;

    this._texManager.uploadPendingTextures();

    gl.useProgram(this._program);

    // Uniform: matriz de proyección y opacidad
    gl.uniformMatrix4fv(this._uMatrix, false, matrix);
    gl.uniform1f(this._uOpacity, this.opacity);

    // Uniform: resolución del grid
    gl.uniform2f(this._uTexSize, this._texManager.gridWidth, this._texManager.gridHeight);

    // Textura 0: datos de temperatura current
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.tempTextureCurrent);
    gl.uniform1i(this._uDataCurrent, 0);

    // Textura 1: datos de temperatura next
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.tempTextureNext);
    gl.uniform1i(this._uDataNext, 1);

    // Textura 2: paleta de color
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this._texManager.rampTexture);
    gl.uniform1i(this._uColorRamp, 2);

    // Mix Factor
    gl.uniform1f(this._uMixFactor, this.mixFactor !== undefined ? this.mixFactor : 0.0);

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
      this.mixFactor = 0.0;
      if (this._map) this._map.triggerRepaint();
    } else {
      // SALA DE ESPERA: Rescate para cuando se enciende el toggle y el mapa no está listo
      this._pendingData = gridData;
    }
  }

  updateDataDual(currentData, nextData, mixFactor = 0.0) {
    if (this._texManager) {
      this._texManager.updateDual(currentData, nextData);
      this.mixFactor = mixFactor;
      if (this._map) this._map.triggerRepaint();
    } else {
      // SALA DE ESPERA: Si el mapa aún no inicializa el manager, guardamos el frame
      this._pendingData = { current: currentData, next: nextData, mix: mixFactor };
    }
  }

  setMixFactor(value) {
    if (this.mixFactor === value) return;
    this.mixFactor = value;
    if (this._map) this._map.triggerRepaint();
  }

  /**
   * Cambia la opacidad sin recompilar shaders.
   */
  setOpacity(value) {
    this.opacity = value;
    if (this._map) this._map.triggerRepaint();
  }

}

// ─── Funciones de Gestión de Capa ────────────────────────────────────

export function addTempLayers(map, customLayer, coastlineId, data) {
  const insertBefore = findOptimalInsertionPoint(map);

  if (!map.getLayer(customLayer.id)) {
    map.addLayer(customLayer, insertBefore);
  }

  // Capa de costas (fronteras hacia el mar)
  if (!map.getLayer(coastlineId)) {
    map.addLayer({
      id: coastlineId,
      type: 'line',
      source: 'composite',
      'source-layer': 'water',
      paint: {
        'line-color': 'rgba(0, 0, 0, 0.4)',
        'line-width': 1.5,
      }
    }, insertBefore);
  }

  if (data && data.length > 0) {
    customLayer.updateData(data);
  }
}

export function removeTempLayers(map, layerId, coastlineId, sourceId, labelLayerId) {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  try {
    if (map.getStyle()) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(coastlineId)) map.removeLayer(coastlineId);
      removeCityTempLabels(map, sourceId, labelLayerId);
    }
  } catch (e) {
    console.warn('[TempColorLayer] Error removiendo capas de temperatura:', e.message);
  }
}

// ─── Capa de Etiquetas de Temperatura en Ciudades Globales ─────────────────────

export function addCityTempLabels(map, geojson, activeTempUnit, sourceId, labelLayerId) {
  try {
    if (map.getSource(sourceId)) return; // Ya existe

    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
    });

    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': [
          'concat',
          ['get', 'name'], '\n',
          ['to-string', ['round', ['to-number', ['get', 'temperatura']]]],
          ` °${activeTempUnit}`
        ],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          2, 10,
          5, 12,
          8, 14,
        ],
        'text-offset': [0, 0],
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-padding': 8,
        'text-optional': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.85)',
        'text-halo-width': 1.8,
        'text-halo-blur': 0.5,
      },
    });
  } catch (e) {
    console.warn('[TempColorLayer] Error añadiendo etiquetas:', e.message);
  }
}

export function updateCityTempLabels(map, geojson, activeTempUnit, sourceId, labelLayerId) {
  try {
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(geojson);
      if (map.getLayer(labelLayerId)) {
        map.setLayoutProperty(labelLayerId, 'text-field', [
          'concat',
          ['get', 'name'], '\n',
          ['to-string', ['round', ['to-number', ['get', 'temperatura']]]],
          ` °${activeTempUnit}`
        ]);
      }
    }
  } catch (e) {
    console.warn('[TempColorLayer] Error actualizando etiquetas:', e.message);
  }
}

export function removeCityTempLabels(map, sourceId, labelLayerId) {
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;
  try {
    if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch (_) { /* ignore */ }
}
