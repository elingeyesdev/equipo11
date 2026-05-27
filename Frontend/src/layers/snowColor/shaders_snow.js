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
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform vec2 u_tex_size;
  uniform int u_snow_type;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;

  // Interpolación bilineal perfecta que corrige el desfase de medio píxel
  vec2 sampleBilinear(float lon, float lat) {
    vec2 texelCoord = vec2(lon + 180.0, lat + 90.0);
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

    vec2 s00 = texture2D(u_snow_data, uv00).rg;
    vec2 s10 = texture2D(u_snow_data, uv10).rg;
    vec2 s01 = texture2D(u_snow_data, uv01).rg;
    vec2 s11 = texture2D(u_snow_data, uv11).rg;

    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }

  void main() {
    // Resolver Antimeridiano y extraer WGS84
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    // Extraer ambos valores normalizados de la nieve (r = acumulada, g = fresca)
    vec2 snowNorms = sampleBilinear(lon, lat); 
    
    // Seleccionar según el toggle del usuario
    float activeSnowNorm = u_snow_type == 1 ? snowNorms.g : snowNorms.r;

    // Umbral estricto: Descartar si es menor a 0.2 cm. 
    // Asumiendo MAX_SNOW = 150.0, entonces 0.2 / 150.0 = ~0.00133
    if (activeSnowNorm < 0.00133) {
      discard;
    }
    
    // Buscar el color exacto en la textura de la paleta discreta (SNOW_RAMP)
    vec4 baseColor = texture2D(u_color_ramp, vec2(activeSnowNorm, 0.5));
    
    // Filtrado de Ruido en el borde:
    // Smoothstep difumina suavemente el borde exterior absoluto (de 0.0013 a 0.005)
    // Conserva los escalones duros internos, pero funde la frontera exterior con el mapa.
    float edgeAlpha = smoothstep(0.00133, 0.005, activeSnowNorm);

    // Aplicar opacidad
    gl_FragColor = vec4(baseColor.rgb, baseColor.a * u_opacity * edgeAlpha);
  }
`;
