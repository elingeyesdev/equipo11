import { vertexShaderSource, fragmentShaderSource } from './shaders_temp.js';
import TempDataTexture from './TempDataTexture.js';
import { findOptimalInsertionPoint } from '../rainColor/layerManager_rain.js';

export default class TempColorLayer {
  constructor(options = {}) {
    this.id = options.id || 'temp-color-layer';
    this.type = 'custom';
    this.renderingMode = '2d';
    this.opacity = options.opacity !== undefined ? options.opacity : 0.85;

    this.program = null;
    this.vertexBuffer = null;
    this.dataTexture = null;

    // Matriz de proyección de mapbox
    this.uMatrixLoc = null;
    this.uOpacityLoc = null;
    this.uTempDataLoc = null;
    this.uColorRampLoc = null;
    this.uOffsetLoc = null;
    this.aPosLoc = null;
  }

  onAdd(map, gl) {
    this.map = map;
    this.gl = gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex Shader Error:', gl.getShaderInfoLog(vertexShader));
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment Shader Error:', gl.getShaderInfoLog(fragmentShader));
    }

    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program Link Error:', gl.getProgramInfoLog(this.program));
    }

    this.aPosLoc = gl.getAttribLocation(this.program, 'a_pos');
    this.uMatrixLoc = gl.getUniformLocation(this.program, 'u_matrix');
    this.uOpacityLoc = gl.getUniformLocation(this.program, 'u_opacity');
    this.uTempDataLoc = gl.getUniformLocation(this.program, 'u_temp_data');
    this.uColorRampLoc = gl.getUniformLocation(this.program, 'u_color_ramp');
    this.uOffsetLoc = gl.getUniformLocation(this.program, 'u_offset');

    // Quad covering the entire world map
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.dataTexture = new TempDataTexture(gl);
  }

  updateData(gridData) {
    if (this.dataTexture) {
      this.dataTexture.update(gridData);
      if (this.map) this.map.triggerRepaint();
    }
  }

  render(gl, matrix) {
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(this.aPosLoc);
    gl.vertexAttribPointer(this.aPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(this.uMatrixLoc, false, matrix);
    gl.uniform1f(this.uOpacityLoc, this.opacity);
    gl.uniform1f(this.uOffsetLoc, 0.5);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture.tempTexture);
    gl.uniform1i(this.uTempDataLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture.rampTexture);
    gl.uniform1i(this.uColorRampLoc, 1);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Limpieza estricta del estado WebGL para evitar sangrado hacia Mapbox
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  destroy() {
    if (this.dataTexture) {
      this.dataTexture.destroy();
      this.dataTexture = null;
    }
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      this.gl.deleteBuffer(this.vertexBuffer);
      this.program = null;
      this.vertexBuffer = null;
    }
    this.map = null;
    this.gl = null;
  }
}

export function addTempLayers(map, customLayer, data) {
  if (data) {
    customLayer.updateData(data);
  }
  
  if (!map.getLayer(customLayer.id)) {
    const beforeId = map.getLayer('settlement-label') ? 'settlement-label' : 
                     (map.getLayer('place-label') ? 'place-label' : null);
    
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
