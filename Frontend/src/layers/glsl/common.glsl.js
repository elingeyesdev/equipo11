/**
 * Snippets GLSL reutilizables para los fragment shaders.
 * No son módulos GLSL reales (WebGL1 no los soporta),
 * sino templates JS que se inyectan como string en cada shader.
 */

/** Convierte coordenadas Mercator a UV equirectangular */
export const mercatorToEquirectUV = `
  const float PI = 3.14159265359;

  vec2 mercatorToUV(vec2 merc) {
    float wrappedX = fract(merc.x);
    float lon = wrappedX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * merc.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);
    return vec2((lon + 180.0) / 360.0, (lat + 90.0) / 180.0);
  }
`;

/** Interpolación bilineal con wrap horizontal (antimeridiano) */
export const sampleBilinearSingle = `
  float sampleBilinear(vec2 uv, sampler2D tex, vec2 texSize) {
    vec2 texelCoord = uv * texSize - 0.5;
    vec2 base = floor(texelCoord);
    vec2 f = fract(texelCoord);

    float x0 = fract(base.x / texSize.x) * texSize.x;
    float x1 = fract((base.x + 1.0) / texSize.x) * texSize.x;
    float y0 = clamp(base.y, 0.0, texSize.y - 1.0);
    float y1 = clamp(base.y + 1.0, 0.0, texSize.y - 1.0);

    vec2 uv00 = (vec2(x0, y0) + 0.5) / texSize;
    vec2 uv10 = (vec2(x1, y0) + 0.5) / texSize;
    vec2 uv01 = (vec2(x0, y1) + 0.5) / texSize;
    vec2 uv11 = (vec2(x1, y1) + 0.5) / texSize;

    float s00 = texture2D(tex, uv00).r;
    float s10 = texture2D(tex, uv10).r;
    float s01 = texture2D(tex, uv01).r;
    float s11 = texture2D(tex, uv11).r;

    return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  }
`;
