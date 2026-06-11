import { mercatorToEquirectUV, sampleBilinearSingle } from '../glsl/common.glsl.js';

export const vertexSource = `
  attribute vec2 a_pos;
  uniform mat4 u_matrix;
  varying vec2 v_mercator;

  void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    v_mercator = a_pos;
  }
`;

export const fragmentSource = `
  precision highp float;

  uniform sampler2D u_data_current;
  uniform sampler2D u_data_next;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform float u_mix_factor;
  uniform vec2 u_tex_size;

  varying vec2 v_mercator;

  ${mercatorToEquirectUV}
  ${sampleBilinearSingle}

  void main() {
    vec2 uv = mercatorToUV(v_mercator);

    // Interpolación temporal
    float tempCurrent = sampleBilinear(uv, u_data_current, u_tex_size);
    float tempNext = sampleBilinear(uv, u_data_next, u_tex_size);
    float temp = mix(tempCurrent, tempNext, u_mix_factor);

    // Muestrear la paleta de color (textura 1D de 256 px)
    vec4 color = texture2D(u_color_ramp, vec2(temp, 0.5));

    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;
