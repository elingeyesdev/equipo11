/**
 * colorRamps_rain.js — Paleta de colores para intensidad de lluvia.
 * Implementa 22 stops para representar visualmente la no-linealidad.
 */

export const RAIN_RAMP_22 = [
  { val: 0.0, color: [0, 0, 0, 0] },
  { val: 0.2, color: [162, 248, 248, 160] },
  { val: 0.5, color: [120, 220, 255, 170] },
  { val: 1.0, color: [60, 180, 255, 180] },
  { val: 2.0, color: [30, 140, 240, 190] },
  { val: 3.0, color: [0, 100, 220, 210] },
  { val: 4.0, color: [0, 60, 190, 230] },
  { val: 5.0, color: [0, 20, 150, 255] },
  { val: 7.5, color: [15, 10, 120, 255] },
  { val: 10.0, color: [30, 0, 90, 255] },
  { val: 15.0, color: [90, 0, 120, 255] },
  { val: 20.0, color: [150, 0, 150, 255] },
  { val: 25.0, color: [185, 20, 150, 255] },
  { val: 30.0, color: [220, 40, 150, 255] },
  { val: 35.0, color: [240, 20, 100, 255] },
  { val: 40.0, color: [255, 0, 0, 255] },
  { val: 50.0, color: [200, 0, 0, 255] },
  { val: 60.0, color: [150, 0, 0, 255] },
  { val: 70.0, color: [100, 0, 0, 255] },
  { val: 85.0, color: [70, 0, 0, 255] },
  { val: 100.0, color: [40, 0, 0, 255] },
  { val: 150.0, color: [20, 0, 0, 255] }
];

export const DEFAULT_RAIN_RAMP = RAIN_RAMP_22;

/**
 * Genera la textura de paleta 1D uniformemente distribuida según los índices,
 * no según los valores en mm.
 * Esto alinea el canvas con el "espacio visual" que exige la interpolación de índices.
 */
export function buildRainColorRampTexture(ramp = DEFAULT_RAIN_RAMP) {
  const size = 256;
  const pixels = new Uint8Array(size * 4);
  const stopsCount = ramp.length;

  for (let i = 0; i < size; i++) {
    // norm va de 0.0 a 1.0 a lo largo del canvas
    const norm = i / (size - 1);
    
    // Mapear este norm de vuelta al espacio de índices fraccionales
    const virtualIndex = norm * (stopsCount - 1);
    const indexFloor = Math.floor(virtualIndex);
    
    if (indexFloor >= stopsCount - 1) {
      const c = ramp[stopsCount - 1].color;
      pixels[i * 4 + 0] = c[0];
      pixels[i * 4 + 1] = c[1];
      pixels[i * 4 + 2] = c[2];
      pixels[i * 4 + 3] = c[3];
      continue;
    }
    
    const fraction = virtualIndex - indexFloor;
    const c1 = ramp[indexFloor].color;
    const c2 = ramp[indexFloor + 1].color;
    
    pixels[i * 4 + 0] = c1[0] + (c2[0] - c1[0]) * fraction;
    pixels[i * 4 + 1] = c1[1] + (c2[1] - c1[1]) * fraction;
    pixels[i * 4 + 2] = c1[2] + (c2[2] - c1[2]) * fraction;
    pixels[i * 4 + 3] = c1[3] + (c2[3] - c1[3]) * fraction;
  }
  
  return pixels;
}
