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

  uniform sampler2D u_aqi_data;
  uniform sampler2D u_aqi_data_next;
  uniform float u_opacity;
  uniform vec2 u_tex_size;
  uniform float u_mix_factor;

  varying vec2 v_mercator;

  ${mercatorToEquirectUV}
  ${sampleBilinearSingle}

  void main() {
    vec2 uv = mercatorToUV(v_mercator);

    float aqiNormCurrent = sampleBilinear(uv, u_aqi_data, u_tex_size);
    float aqiNormNext = sampleBilinear(uv, u_aqi_data_next, u_tex_size);
    float aqi_norm = mix(aqiNormCurrent, aqiNormNext, u_mix_factor);

    // aqi_norm corresponds to the byte value (0 to 1). The actual value was divided by 2.
    // So to get the real AQI value back, we do aqi_norm * 255.0 * 2.0
    float aqi_val = aqi_norm * 510.0;

    // EPA Standard AQI Colors with new custom light blues
    vec3 c0 = vec3(0.878, 0.949, 1.0);     // 0-10: Celeste muy suave [224, 242, 255]
    vec3 c1 = vec3(0.490, 0.827, 1.0);     // 11-30: Celeste claro [125, 211, 255]
    vec3 c2 = vec3(0.0, 0.894, 0.0);       // 50: Verde [0, 228, 0]
    vec3 c3 = vec3(1.0, 1.0, 0.0);         // 100: Amarillo [255, 255, 0]
    vec3 c4 = vec3(1.0, 0.494, 0.0);       // 150: Naranja [255, 126, 0]
    vec3 c5 = vec3(1.0, 0.0, 0.0);         // 200: Rojo [255, 0, 0]
    vec3 c6 = vec3(0.561, 0.247, 0.592);   // 300: Púrpura [143, 63, 151]
    vec3 c7 = vec3(0.494, 0.0, 0.137);     // 500: Burdeos [126, 0, 35]

    vec3 finalColor;
    
    if (aqi_val <= 10.0) {
      finalColor = c0;
    } else if (aqi_val <= 30.0) {
      finalColor = mix(c0, c1, (aqi_val - 10.0) / 20.0);
    } else if (aqi_val <= 50.0) {
      finalColor = mix(c1, c2, (aqi_val - 30.0) / 20.0);
    } else if (aqi_val <= 100.0) {
      finalColor = mix(c2, c3, (aqi_val - 50.0) / 50.0);
    } else if (aqi_val <= 150.0) {
      finalColor = mix(c3, c4, (aqi_val - 100.0) / 50.0);
    } else if (aqi_val <= 200.0) {
      finalColor = mix(c4, c5, (aqi_val - 150.0) / 50.0);
    } else if (aqi_val <= 300.0) {
      finalColor = mix(c5, c6, (aqi_val - 200.0) / 100.0);
    } else {
      finalColor = mix(c6, c7, clamp((aqi_val - 300.0) / 200.0, 0.0, 1.0));
    }

    gl_FragColor = vec4(finalColor, u_opacity);
  }
`;
