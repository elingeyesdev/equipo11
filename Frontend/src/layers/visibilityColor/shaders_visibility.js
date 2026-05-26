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

  uniform sampler2D u_vis_data;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform vec2 u_tex_size;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;

  void main() {
    // Resolver Antimeridiano y extraer WGS84
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    // Calcular las coordenadas UV directamente basadas en lat y lon
    vec2 uv = vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0);

    // Extraer valor normalizado de visibilidad usando el filtro de textura (gl.LINEAR)
    float visNorm = texture2D(u_vis_data, uv).r; 

    // Descartar solo si la visibilidad es mayor a ~22 km (cielo totalmente despejado)
    // 22000 / 24000 = ~0.916
    if (visNorm > 0.916) {
      discard;
    }
    
    // Buscar el color exacto en la textura de la paleta
    vec4 baseColor = texture2D(u_color_ramp, vec2(visNorm, 0.5));
    
    // Aplicar opacidad
    gl_FragColor = vec4(baseColor.rgb, baseColor.a * u_opacity);
  }
`;
