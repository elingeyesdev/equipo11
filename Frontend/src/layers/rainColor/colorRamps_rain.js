/**
 * colorRamps_rain.js — Paleta de colores para intensidad de lluvia.
 * Implementa 22 stops para representar visualmente la no-linealidad.
 */

export const DEFAULT_RAIN_RAMP = [
  { val: 0.0, color: [0, 0, 0, 0] },
  { val: 0.1, color: [0, 255, 255, 255] },
  { val: 2.0, color: [0, 0, 255, 255] },
  { val: 10.0, color: [128, 0, 128, 255] },
  { val: 20.0, color: [255, 0, 255, 255] }
];

export function buildRainColorRampTexture(ramp = DEFAULT_RAIN_RAMP) {
  const maxRain = 20.0;
  const size = 256;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const rain = (i / (size - 1)) * maxRain;

    let lo = ramp[0];
    let hi = ramp[ramp.length - 1];

    for (let j = 0; j < ramp.length - 1; j++) {
      if (rain >= ramp[j].val && rain <= ramp[j + 1].val) {
        lo = ramp[j];
        hi = ramp[j + 1];
        break;
      }
    }

    const range = hi.val - lo.val;
    const t = range > 0 ? Math.min(1, Math.max(0, (rain - lo.val) / range)) : 0;

    pixels[i * 4 + 0] = Math.round(lo.color[0] + t * (hi.color[0] - lo.color[0]));
    pixels[i * 4 + 1] = Math.round(lo.color[1] + t * (hi.color[1] - lo.color[1]));
    pixels[i * 4 + 2] = Math.round(lo.color[2] + t * (hi.color[2] - lo.color[2]));
    pixels[i * 4 + 3] = Math.round(lo.color[3] + t * (hi.color[3] - lo.color[3]));
  }

  return pixels;
}
