/**
 * colorRamps_vis.js — Paleta de colores continua para Visibilidad.
 * Implementa un gradiente suave mapeado por índices interpolados.
 */

export const VISIBILITY_RAMP_8 = [
  { val: 0.0, color: [139, 69, 19, 255] },      // #8b4513
  { val: 1.0, color: [210, 105, 30, 255] },     // #d2691e
  { val: 2.0, color: [244, 164, 96, 255] },     // #f4a460
  { val: 5.0, color: [245, 222, 179, 255] },    // #f5deb3
  { val: 10.0, color: [240, 240, 240, 128] },   // Gris pálido translúcido
  { val: 20.0, color: [255, 255, 255, 0] },     // 100% transparente
  { val: 24.0, color: [255, 255, 255, 0] }
];

export const DEFAULT_VIS_RAMP = VISIBILITY_RAMP_8;

export function buildVisibilityColorRampTexture(ramp = DEFAULT_VIS_RAMP, maxVis = 24.0) {
  const size = 256;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const vis = (i / (size - 1)) * maxVis;

    let lo = ramp[0];
    let hi = ramp[ramp.length - 1];

    for (let j = 0; j < ramp.length - 1; j++) {
      if (vis >= ramp[j].val && vis <= ramp[j + 1].val) {
        lo = ramp[j];
        hi = ramp[j + 1];
        break;
      }
    }

    const range = hi.val - lo.val;
    const t = range > 0 ? Math.min(1, Math.max(0, (vis - lo.val) / range)) : 0;

    pixels[i * 4 + 0] = Math.round(lo.color[0] + t * (hi.color[0] - lo.color[0]));
    pixels[i * 4 + 1] = Math.round(lo.color[1] + t * (hi.color[1] - lo.color[1]));
    pixels[i * 4 + 2] = Math.round(lo.color[2] + t * (hi.color[2] - lo.color[2]));
    pixels[i * 4 + 3] = Math.round(lo.color[3] + t * (hi.color[3] - lo.color[3]));
  }

  return pixels;
}
