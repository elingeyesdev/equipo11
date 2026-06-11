import mapboxgl from 'mapbox-gl';

/**
 * Compila un shader WebGL con manejo de errores unificado.
 * @param {WebGLRenderingContext} gl
 * @param {number} type — gl.VERTEX_SHADER o gl.FRAGMENT_SHADER
 * @param {string} source — Código GLSL
 * @param {string} layerName — Nombre de la capa para logs (ej. 'WindColorLayer')
 * @returns {WebGLShader|null}
 */
export function compileShader(gl, type, source, layerName) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const label = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    console.error(`[${layerName}] ${label} shader error:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Crea el quad Mercator extendido (-5 a 6) para wrap horizontal infinito.
 * Todas las capas usan la misma geometría.
 */
export function createMercatorQuad(map) {
  const yTop = mapboxgl.MercatorCoordinate.fromLngLat([0, 85.051]).y;
  const yBottom = mapboxgl.MercatorCoordinate.fromLngLat([0, -85.051]).y;

  return new Float32Array([
    -5.0, yTop,
     6.0, yTop,
    -5.0, yBottom,
     6.0, yTop,
     6.0, yBottom,
    -5.0, yBottom,
  ]);
}
