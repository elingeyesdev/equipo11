/**
 * colorRamps_snow.js — Paletas de colores para Nieve (Fresca y Acumulada).
 */

export const SNOW_FRESH_RAMP = [
  { val: 0.0, color: [255, 255, 255, 0] }, // Blanco Transparente
  { val: 0.1, color: [255, 255, 255, 255] }, // Blanco Opaco
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
    const val = (i / 255.0) * maxSnow;
    let c = ramp[0].color; // Default al mínimo (Transparente)
    
    for (let j = 0; j < ramp.length - 1; j++) {
      if (val >= ramp[j].val && val <= ramp[j+1].val) {
        const t = (val - ramp[j].val) / (ramp[j+1].val - ramp[j].val);
        c = [
          Math.round(ramp[j].color[0] + t * (ramp[j+1].color[0] - ramp[j].color[0])),
          Math.round(ramp[j].color[1] + t * (ramp[j+1].color[1] - ramp[j].color[1])),
          Math.round(ramp[j].color[2] + t * (ramp[j+1].color[2] - ramp[j].color[2])),
          Math.round(ramp[j].color[3] + t * (ramp[j+1].color[3] - ramp[j].color[3]))
        ];
        break;
      }
    }
    pixels.set(c, i * 4);
  }
  return pixels;
}
