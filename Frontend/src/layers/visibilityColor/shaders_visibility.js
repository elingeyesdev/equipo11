export const vertexSource = `
  precision highp float;
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
  uniform sampler2D u_vis_data_next;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform vec2 u_tex_size;
  uniform float u_mix_factor;

  varying vec2 v_mercator;

  const float PI = 3.14159265359;

  float sampleBilinear(vec2 uv, sampler2D tex, float px, float py) {
    float x0 = floor(px);
    float y0 = floor(py);
    float u = fract(px);
    float v = fract(py);

    float x1 = x0 + 1.0;
    float y1 = y0 + 1.0;

    float y0_c = clamp(y0, 0.0, 179.0);
    float y1_c = clamp(y1, 0.0, 179.0);

    float wrap_x0 = mod(x0, 360.0);
    float wrap_x1 = mod(x1, 360.0);

    vec2 uv00 = vec2((wrap_x0 + 0.5) / 360.0, (y0_c + 0.5) / 180.0);
    vec2 uv10 = vec2((wrap_x1 + 0.5) / 360.0, (y0_c + 0.5) / 180.0);
    vec2 uv01 = vec2((wrap_x0 + 0.5) / 360.0, (y1_c + 0.5) / 180.0);
    vec2 uv11 = vec2((wrap_x1 + 0.5) / 360.0, (y1_c + 0.5) / 180.0);

    float val00 = texture2D(tex, uv00).r;
    float val10 = texture2D(tex, uv10).r;
    float val01 = texture2D(tex, uv01).r;
    float val11 = texture2D(tex, uv11).r;

    return mix( mix(val00, val10, u), mix(val01, val11, u), v );
  }

  void main() {
    float wrappedMercatorX = fract(v_mercator.x);
    float lon = wrappedMercatorX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    float normalized_x = (lon + 180.0) / 360.0;
    float normalized_y = (lat + 90.0) / 180.0;

    float px = normalized_x * 360.0 - 0.5;
    float py = normalized_y * 180.0 - 0.5;

    float valCurrent = sampleBilinear(vec2(0.0), u_vis_data, px, py);
    float valNext = sampleBilinear(vec2(0.0), u_vis_data_next, px, py);

    float finalVal = mix(valCurrent, valNext, u_mix_factor);

    if (finalVal >= (20.0 / 24.0)) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    vec4 color = texture2D(u_color_ramp, vec2(finalVal, 0.5));
    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;
