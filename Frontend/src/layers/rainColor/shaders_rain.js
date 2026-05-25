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
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform vec2 u_tex_size;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;

  // Interpolación bilineal perfecta que corrige el desfase de medio píxel
  float sampleBilinear(float lon, float lat) {
    // Mapeo directo y exacto de coordenadas WGS84 a la rejilla de píxeles
    vec2 texelCoord = vec2(lon + 180.0, lat + 90.0);
    vec2 base = floor(texelCoord);
    vec2 f = fract(texelCoord);

    // Wrap horizontal con fract()
    float x0 = fract(base.x / u_tex_size.x) * u_tex_size.x;
    float x1 = fract((base.x + 1.0) / u_tex_size.x) * u_tex_size.x;

    // Clamp vertical
    float y0 = clamp(base.y, 0.0, u_tex_size.y - 1.0);
    float y1 = clamp(base.y + 1.0, 0.0, u_tex_size.y - 1.0);

    vec2 uv00 = (vec2(x0, y0) + 0.5) / u_tex_size;
    vec2 uv10 = (vec2(x1, y0) + 0.5) / u_tex_size;
    vec2 uv01 = (vec2(x0, y1) + 0.5) / u_tex_size;
    vec2 uv11 = (vec2(x1, y1) + 0.5) / u_tex_size;

    float s00 = texture2D(u_rain_data, uv00).r;
    float s10 = texture2D(u_rain_data, uv10).r;
    float s01 = texture2D(u_rain_data, uv01).r;
    float s11 = texture2D(u_rain_data, uv11).r;

    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }

  void main() {
    // Resolver Antimeridiano y extraer WGS84
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    // Extraer valor de lluvia (normalizado de 0 a 1) usando la alineación perfecta
    float rainNorm = sampleBilinear(lon, lat); 

    // Optimización extrema: si no alcanza el umbral mínimo de lluvia visible (0.2mm), descartar.
    // Como MAX_RAIN es 50.0, 0.19mm normalizado es 0.19 / 50.0 = 0.0038
    if (rainNorm < 0.0038) {
      discard;
    }
    
    // Lookup de color (Paleta Meteored Discreta)
    vec4 baseColor = texture2D(u_color_ramp, vec2(rainNorm, 0.5));
    
    // Aplicar la opacidad global conservando el diseño de la paleta
    gl_FragColor = vec4(baseColor.rgb, baseColor.a * u_opacity);
  }
`;
