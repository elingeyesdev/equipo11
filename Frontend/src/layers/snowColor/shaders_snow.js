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

  uniform sampler2D u_snow_data;
  uniform sampler2D u_snow_data_next;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform float u_mix_factor;
  uniform vec2 u_tex_size;
  uniform float u_snow_type;

  varying vec2 v_mercator;
  const float PI = 3.14159265359;

  // Interpolación bilineal manual con soporte para canales R y G (Fresca vs Acumulada)
  float sampleBilinearSnow(vec2 uv, sampler2D tex) {
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

    vec4 c00 = texture2D(tex, uv00);
    vec4 c10 = texture2D(tex, uv10);
    vec4 c01 = texture2D(tex, uv01);
    vec4 c11 = texture2D(tex, uv11);

    float s00 = mix(c00.r, c00.g, u_snow_type);
    float s10 = mix(c10.r, c10.g, u_snow_type);
    float s01 = mix(c01.r, c01.g, u_snow_type);
    float s11 = mix(c11.r, c11.g, u_snow_type);

    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }

  void main() {
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    vec2 v_uv = vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0);

    float snowNormCurrent = sampleBilinearSnow(v_uv, u_snow_data);
    float snowNormNext = sampleBilinearSnow(v_uv, u_snow_data_next);
    float snowNorm = mix(snowNormCurrent, snowNormNext, u_mix_factor);

    float decodedSnow = snowNorm * 150.0;
    float maxSnow = 150.0;
    float normalizedSnow = clamp(decodedSnow / maxSnow, 0.0, 1.0);
    vec4 baseColor = texture2D(u_color_ramp, vec2(normalizedSnow, 0.5));
    gl_FragColor = vec4(baseColor.rgb, baseColor.a * u_opacity);
  }
`;
