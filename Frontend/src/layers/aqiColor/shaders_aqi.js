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

  const float PI = 3.14159265359;

  float sampleBilinear(vec2 uv, sampler2D tex) {
    vec2 texelCoord = uv * u_tex_size - 0.5;
    vec2 base = floor(texelCoord);
    vec2 f = fract(texelCoord);

    float x0 = fract(base.x / u_tex_size.x) * u_tex_size.x;
    float x1 = fract((base.x + 1.0) / u_tex_size.x) * u_tex_size.x;

    float y0 = clamp(base.y, 0.0, u_tex_size.y - 1.0);
    float y1 = clamp(base.y + 1.0, 0.0, u_tex_size.y - 1.0);

    vec2 uv00 = (vec2(x0, y0) + 0.5) / u_tex_size;
    vec2 uv10 = (vec2(x1, y0) + 0.5) / u_tex_size;
    vec2 uv01 = (vec2(x0, y1) + 0.5) / u_tex_size;
    vec2 uv11 = (vec2(x1, y1) + 0.5) / u_tex_size;

    float s00 = texture2D(tex, uv00).r;
    float s10 = texture2D(tex, uv10).r;
    float s01 = texture2D(tex, uv01).r;
    float s11 = texture2D(tex, uv11).r;

    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }

  void main() {
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    vec2 uv = vec2(
      (lon + 180.0) / 360.0,
      (lat + 90.0) / 180.0
    );

    float aqiNormCurrent = sampleBilinear(uv, u_aqi_data);
    float aqiNormNext = sampleBilinear(uv, u_aqi_data_next);
    float aqi_norm = mix(aqiNormCurrent, aqiNormNext, u_mix_factor);

    // aqi_norm corresponds to the byte value (0 to 1). The actual value was divided by 2.
    // So to get the real AQI value back, we do aqi_norm * 255.0 * 2.0
    float aqi_val = aqi_norm * 510.0;

    vec3 c0 = vec3(0.867, 1.0, 1.0);     // 0: #ddffff
    vec3 c1 = vec3(0.0, 0.816, 1.0);     // 50: #00d0ff
    vec3 c2 = vec3(0.0, 0.902, 0.0);     // 100: #00e600
    vec3 c3 = vec3(1.0, 1.0, 0.0);       // 150: #ffff00
    vec3 c4 = vec3(1.0, 0.6, 0.2);       // 200: #ff9933
    vec3 c5 = vec3(1.0, 0.0, 0.0);       // 300: #ff0000
    vec3 c6 = vec3(0.6, 0.0, 0.0);       // 400: #990000
    vec3 c7 = vec3(0.502, 0.0, 0.502);   // 500: #800080

    vec3 finalColor = c0;
    
    if (aqi_val < 50.0) {
      finalColor = mix(c0, c1, aqi_val / 50.0);
    } else if (aqi_val < 100.0) {
      finalColor = mix(c1, c2, (aqi_val - 50.0) / 50.0);
    } else if (aqi_val < 150.0) {
      finalColor = mix(c2, c3, (aqi_val - 100.0) / 50.0);
    } else if (aqi_val < 200.0) {
      finalColor = mix(c3, c4, (aqi_val - 150.0) / 50.0);
    } else if (aqi_val < 300.0) {
      finalColor = mix(c4, c5, (aqi_val - 200.0) / 100.0);
    } else if (aqi_val < 400.0) {
      finalColor = mix(c5, c6, (aqi_val - 300.0) / 100.0);
    } else {
      finalColor = mix(c6, c7, clamp((aqi_val - 400.0) / 100.0, 0.0, 1.0));
    }

    gl_FragColor = vec4(finalColor, u_opacity);
  }
`;
