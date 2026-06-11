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

  uniform sampler2D u_wind_data;
  uniform sampler2D u_wind_data_next;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform vec2 u_tex_size;
  uniform float u_mix_factor;

  varying vec2 v_mercator;

  ${mercatorToEquirectUV}
  ${sampleBilinearSingle}

  void main() {
    vec2 uv = mercatorToUV(v_mercator);

    // Interpolación bilineal manual
    float speedCurrent = sampleBilinear(uv, u_wind_data, u_tex_size);
    float speedNext = sampleBilinear(uv, u_wind_data_next, u_tex_size);
    float speedNorm = mix(speedCurrent, speedNext, u_mix_factor);

    // El backend codifica el viento con MAX_SPEED = 150.0
    float realSpeed = speedNorm * 150.0;
    
    // La rampa de color está escalada matemáticamente a 140.0
    float rampNorm = clamp(realSpeed / 140.0, 0.0, 1.0);

    // Muestrear la paleta de color (textura 1D de 256 px)
    vec4 color = texture2D(u_color_ramp, vec2(rampNorm, 0.5));

    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;
