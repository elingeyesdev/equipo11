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
  uniform vec2 u_tex_size;
  uniform float u_mix_factor;
  uniform float u_snow_type;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;

  void main() {
    // Resolver Antimeridiano y extraer WGS84
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    vec2 v_uv = vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0);
    
    // Hardware bilinear filtering directly on UV
    vec4 texColorCurrent = texture2D(u_snow_data, v_uv);
    vec4 texColorNext = texture2D(u_snow_data_next, v_uv);
    
    float snowNormCurrent = mix(texColorCurrent.r, texColorCurrent.g, u_snow_type);
    float snowNormNext = mix(texColorNext.r, texColorNext.g, u_snow_type);
    
    float activeSnowNorm = mix(snowNormCurrent, snowNormNext, u_mix_factor);

    // El backend codifica Acumulada sobre 150.0, y Fresca sobre 300.0
    float maxDecode = mix(150.0, 300.0, u_snow_type);
    float decodedSnow = activeSnowNorm * maxDecode;

    float alphaFade = smoothstep(0.0, 0.5, decodedSnow);
    if (alphaFade == 0.0) { 
      discard; 
    }
    
    // La rampa de color SIEMPRE está normalizada a 150.0
    float maxSnow = 150.0;
    float normalizedSnow = clamp(decodedSnow / maxSnow, 0.0, 1.0);
    vec4 color = texture2D(u_color_ramp, vec2(normalizedSnow, 0.5));
    
    gl_FragColor = vec4(color.rgb, color.a * alphaFade * u_opacity);
  }
`;
