/**
 * shaders.js — Vertex y Fragment shaders GLSL para la capa de color de viento.
 *
 * Responsabilidad: definir únicamente la lógica de rendering.
 * - El vertex shader posiciona un quad geográfico usando la matriz de Mapbox.
 * - El fragment shader convierte coordenadas Mercator → lon/lat,
 *   muestrea la textura de datos con interpolación bilineal,
 *   y mapea la velocidad a color via la textura del color ramp.
 *
 * Interpolación bilineal manual:
 *   Cuando gl.LINEAR no está disponible (WebGL1 + texturas NPOT),
 *   el shader realiza 4 muestreos explícitos y mezcla con mix().
 *   El eje X usa fract() para resolver el antimeridiano (lon ±180°).
 *   Cuando gl.LINEAR sí funciona (WebGL2), el uniform u_manual_interp
 *   se pone a 0.0 y la GPU hace la interpolación nativamente.
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

  uniform sampler2D u_wind_data;
  uniform sampler2D u_wind_data_next;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform vec2 u_tex_size;
  uniform float u_mix_factor;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;

  // Interpolación bilineal manual con wrap horizontal perfecto (antimeridiano).
  // Muestrea 4 texeles vecinos y mezcla suavemente garantizando continuidad en longitud ±180°.
  float sampleBilinear(vec2 uv, sampler2D tex) {
    vec2 texelCoord = uv * u_tex_size - 0.5;
    vec2 base = floor(texelCoord);
    vec2 f = fract(texelCoord);

    // Wrap horizontal con fract() — continuidad perfecta en el Pacífico
    // Usamos fract para que los índices negativos se envuelvan a la derecha
    float x0 = fract(base.x / u_tex_size.x) * u_tex_size.x;
    float x1 = fract((base.x + 1.0) / u_tex_size.x) * u_tex_size.x;

    // Clamp vertical — los polos no se envuelven
    float y0 = clamp(base.y, 0.0, u_tex_size.y - 1.0);
    float y1 = clamp(base.y + 1.0, 0.0, u_tex_size.y - 1.0);

    // Convertir a coordenadas UV normalizadas [0,1], centrado exacto en el texel
    vec2 uv00 = (vec2(x0, y0) + 0.5) / u_tex_size;
    vec2 uv10 = (vec2(x1, y0) + 0.5) / u_tex_size;
    vec2 uv01 = (vec2(x0, y1) + 0.5) / u_tex_size;
    vec2 uv11 = (vec2(x1, y1) + 0.5) / u_tex_size;

    // 4 muestreos explícitos (NEAREST garantizado en JS)
    float s00 = texture2D(tex, uv00).r;
    float s10 = texture2D(tex, uv10).r;
    float s01 = texture2D(tex, uv01).r;
    float s11 = texture2D(tex, uv11).r;

    // Mezcla bilineal: horizontal primero, luego vertical
    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }

  void main() {
    // --- Mercator -> Geográfico ---
    // Envolver la coordenada Mercator X para resolver el Antimeridiano / Mapbox Wrapping
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    // --- Geográfico -> UV de la textura equirectangular ---
    vec2 uv = vec2(
      (lon + 180.0) / 360.0,
      (lat + 90.0) / 180.0
    );

    // Interpolación bilineal manual SIEMPRE activa (KISS + Garantiza antimeridiano)
    float speedCurrent = sampleBilinear(uv, u_wind_data);
    float speedNext = sampleBilinear(uv, u_wind_data_next);
    float speed = mix(speedCurrent, speedNext, u_mix_factor);

    // Muestrear la paleta de color (textura 1D de 256 px)
    vec4 color = texture2D(u_color_ramp, vec2(speed, 0.5));

    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;
