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

  uniform sampler2D u_rain_data;
  uniform sampler2D u_rain_data_next;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform float u_mix_factor;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;
  const float RAIN_STOPS_COUNT = 22.0;

  // Replica exacta de RAIN_STOPS[] de windMath.js
  // WebGL 1 no permite indexación dinámica de arrays, usamos cascada de ifs
  float getRainStop(int i) {
    if (i == 0)  return 0.0;
    if (i == 1)  return 0.2;
    if (i == 2)  return 0.5;
    if (i == 3)  return 1.0;
    if (i == 4)  return 2.0;
    if (i == 5)  return 3.0;
    if (i == 6)  return 4.0;
    if (i == 7)  return 5.0;
    if (i == 8)  return 7.5;
    if (i == 9)  return 10.0;
    if (i == 10) return 15.0;
    if (i == 11) return 20.0;
    if (i == 12) return 25.0;
    if (i == 13) return 30.0;
    if (i == 14) return 35.0;
    if (i == 15) return 40.0;
    if (i == 16) return 50.0;
    if (i == 17) return 60.0;
    if (i == 18) return 70.0;
    if (i == 19) return 85.0;
    if (i == 20) return 100.0;
    return 150.0; // i == 21
  }

  // Decodificación no-lineal idéntica a decodeRain() de windMath.js
  // norm (0.0-1.0) → mm de precipitación real
  float decodeRainNonLinear(float norm) {
    if (norm <= 0.0) return 0.0;
    float virtualIndex = norm * (RAIN_STOPS_COUNT - 1.0);
    int i = int(floor(virtualIndex));
    float t = fract(virtualIndex);
    if (i >= 21) return 150.0;
    return mix(getRainStop(i), getRainStop(i + 1), t);
  }

  void main() {
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    vec2 v_uv = vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0);

    float rainCurrent = texture2D(u_rain_data, v_uv).r;
    float rainNext = texture2D(u_rain_data_next, v_uv).r;
    float rainNorm = mix(rainCurrent, rainNext, u_mix_factor);

    float decodedRain = decodeRainNonLinear(rainNorm);

    // Early exit ESTRICTO para zonas sin lluvia
    if (decodedRain < 0.1) {
        gl_FragColor = vec4(0.0);
        return;
    }

    // Mapeo a la leyenda visual (0 a 20 mm)
    float normalizedRain = clamp(decodedRain / 20.0, 0.0, 1.0);
    vec4 baseColor = texture2D(u_color_ramp, vec2(normalizedRain, 0.5));
    gl_FragColor = vec4(baseColor.rgb, baseColor.a * u_opacity);
  }
`;
