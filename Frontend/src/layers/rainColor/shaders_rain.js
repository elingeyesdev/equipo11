/**
 * shaders_rain.js — Vertex y Fragment shaders GLSL para la capa de intensidad de lluvia.
 */

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
  uniform vec2 u_tex_size;
  uniform float u_mix_factor;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;

  void main() {
    // Resolver Antimeridiano y extraer WGS84
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    // Mapeo a UV (Hardware filtering)
    vec2 v_uv = vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0);

    // Muestreo directo por hardware (garantiza interpolación bilineal nativa)
    float rainNormCurrent = texture2D(u_rain_data, v_uv).r;
    float rainNormNext = texture2D(u_rain_data_next, v_uv).r;
    
    float rainNorm = mix(rainNormCurrent, rainNormNext, u_mix_factor);

    // Convertir a valor físico (El MAX_RAIN original del PNG de datos es 150.0)
    float decodedRain = rainNorm * 150.0;
    
    // Suavizado de bordes anti-Minecraft
    float alphaFade = smoothstep(0.05, 0.2, decodedRain); 
    if (alphaFade == 0.0) { 
      discard; 
    }
    
    // Forzar la lectura sobre la rampa de 20.0
    float maxRain = 20.0;
    float normalizedRain = clamp(decodedRain / maxRain, 0.0, 1.0);
    vec4 baseColor = texture2D(u_color_ramp, vec2(normalizedRain, 0.5));
    
    gl_FragColor = vec4(baseColor.rgb, baseColor.a * alphaFade * u_opacity);
  }
`;
