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

  uniform sampler2D u_vis_data;
  uniform sampler2D u_vis_data_next;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform vec2 u_tex_size;
  uniform float u_mix_factor;

  varying vec2 v_mercator;

  ${mercatorToEquirectUV}
  ${sampleBilinearSingle}

  void main() {
    vec2 uv = mercatorToUV(v_mercator);

    float valCurrent = sampleBilinear(uv, u_vis_data, u_tex_size);
    float valNext = sampleBilinear(uv, u_vis_data_next, u_tex_size);

    float finalVal = mix(valCurrent, valNext, u_mix_factor);

    if (finalVal >= (20.0 / 24.0)) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    vec4 color = texture2D(u_color_ramp, vec2(finalVal, 0.5));
    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;
