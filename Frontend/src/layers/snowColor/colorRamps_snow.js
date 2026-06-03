/**
 * colorRamps_snow.js — Paletas de colores para Nieve (Fresca y Acumulada).
 */

export const SNOW_FRESH_RAMP = [
  { val: 0.0, color: [255, 255, 255, 255] }, // #FFFFFF (Blanco)
  { val: 5.0, color: [221, 251, 255, 255] }, // #DDFBFF (Celeste hielo)
  { val: 15.0, color: [174, 239, 255, 255] }, // #AEEFFF (Celeste suave)
  { val: 30.0, color: [114, 227, 255, 255] }, // #72E3FF (Cyan frío)
  { val: 50.0, color: [63, 212, 245, 255] }, // #3FD4F5 (Turquesa brillante)
  { val: 75.0, color: [28, 184, 231, 255] }, // #1CB8E7 (Azul tropical)
  { val: 100.0, color: [23, 147, 209, 255] }, // #1793D1 (Azul medio)
  { val: 120.0, color: [19, 108, 181, 255] }, // #136CB5 (Azul profundo)
  { val: 135.0, color: [43, 78, 162, 255] }, // #2B4EA2 (Índigo frío)
  { val: 150.0, color: [64, 12, 112, 255] }  // #400C70 (Púrpura tormenta)
];

export const SNOW_ACCUMULATED_RAMP = SNOW_FRESH_RAMP;

export function buildSnowColorRampTexture(ramp) {
  const maxSnow = 150.0;
  const size = 256;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const snow = (i / (size - 1)) * maxSnow;

    let lo = ramp[0];
    let hi = ramp[ramp.length - 1];

    for (let j = 0; j < ramp.length - 1; j++) {
      if (snow >= ramp[j].val && snow <= ramp[j + 1].val) {
        lo = ramp[j];
        hi = ramp[j + 1];
        break;
      }
    }

    const range = hi.val - lo.val;
    const t = range > 0 ? Math.min(1, Math.max(0, (snow - lo.val) / range)) : 0;

    pixels[i * 4 + 0] = Math.round(lo.color[0] + t * (hi.color[0] - lo.color[0]));
    pixels[i * 4 + 1] = Math.round(lo.color[1] + t * (hi.color[1] - lo.color[1]));
    pixels[i * 4 + 2] = Math.round(lo.color[2] + t * (hi.color[2] - lo.color[2]));
    pixels[i * 4 + 3] = Math.round(lo.color[3] + t * (hi.color[3] - lo.color[3]));
  }

  return pixels;
}
