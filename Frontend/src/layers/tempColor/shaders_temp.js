export const vertexShaderSource = `
  uniform mat4 u_matrix;
  attribute vec2 a_pos;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = a_pos * 0.5 + 0.5; // Normalizar clip space a UV 0-1
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  }
`;

export const fragmentShaderSource = `
  precision highp float;

  uniform sampler2D u_temp_data;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform float u_offset;

  varying vec2 v_texCoord;

  // Manual bilinear interpolation to wrap properly
  vec4 textureBilinear(sampler2D tex, vec2 uv, vec2 size) {
    uv = clamp(uv, 0.0, 1.0);
    vec2 pos = uv * size - 0.5;
    vec2 f = fract(pos);

    vec2 pos00 = floor(pos) / size;
    vec2 pos10 = (floor(pos) + vec2(1.0, 0.0)) / size;
    vec2 pos01 = (floor(pos) + vec2(0.0, 1.0)) / size;
    vec2 pos11 = (floor(pos) + vec2(1.0, 1.0)) / size;

    // Fix antimeridian wrap manually
    pos00.x = fract(pos00.x);
    pos10.x = fract(pos10.x);
    pos01.x = fract(pos01.x);
    pos11.x = fract(pos11.x);

    vec4 t00 = texture2D(tex, pos00);
    vec4 t10 = texture2D(tex, pos10);
    vec4 t01 = texture2D(tex, pos01);
    vec4 t11 = texture2D(tex, pos11);

    vec4 tA = mix(t00, t10, f.x);
    vec4 tB = mix(t01, t11, f.x);
    return mix(tA, tB, f.y);
  }

  void main() {
    // 1. Invertir el eje Y (1.0 - uv.y) para ver si la textura está "boca abajo"
    vec2 uv = vec2(fract(v_texCoord.x + u_offset), 1.0 - v_texCoord.y);
    
    vec4 tempPixel = textureBilinear(u_temp_data, uv, vec2(360.0, 180.0));
    
    if (tempPixel.a < 0.1) discard;

    float tempNorm = clamp(tempPixel.r, 0.0, 1.0);
    vec4 color = texture2D(u_color_ramp, vec2(tempNorm, 0.5));

    gl_FragColor = vec4(color.rgb, 0.7 * u_opacity);
  }
`;
