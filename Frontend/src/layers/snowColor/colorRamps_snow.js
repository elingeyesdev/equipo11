/**
 * colorRamps_snow.js — Paletas de colores para Nieve (Fresca y Acumulada).
 */

// --- NIEVE FRESCA (12 Segmentos / 13 Stops) ---
export const SNOW_FRESH_RAMP = [
  { val: 0.1, color: [0, 0, 0, 0] },          // 0/12: Transparente
  { val: 1.0, color: [0, 255, 0, 255] },      // 1/12: Verde Lima
  { val: 3.0, color: [0, 230, 0, 255] },      // 2/12: Verde Claro
  { val: 5.0, color: [0, 204, 0, 255] },      // 3/12: Verde Medio
  { val: 10.0, color: [0, 153, 0, 255] },     // 4/12: Verde Oscuro
  { val: 20.0, color: [0, 102, 0, 255] },     // 5/12: Verde Bosque
  { val: 30.0, color: [0, 51, 0, 255] },      // 6/12: Verde Muy Oscuro
  { val: 40.0, color: [255, 255, 0, 255] },   // 7/12: Amarillo
  { val: 50.0, color: [255, 153, 0, 255] },   // 8/12: Naranja
  { val: 100.0, color: [255, 102, 0, 255] },  // 9/12: Naranja Oscuro
  { val: 150.0, color: [255, 0, 0, 255] },    // 10/12: Rojo
  { val: 225.0, color: [204, 0, 0, 255] },    // 11/12: Rojo Oscuro
  { val: 300.0, color: [153, 0, 0, 255] }     // 12/12: Granate/Maroon
];

// --- NIEVE ACUMULADA (8 Segmentos) ---
// Conservamos los colores actuales pero los mapeamos por índices.
export const SNOW_ACCUMULATED_RAMP = [
  { val: 0.2, color: [0, 0, 0, 0] },             // Transparente
  { val: 1.0, color: [150, 255, 150, 128] },     // Verde muy claro
  { val: 5.0, color: [0, 200, 0, 160] },         // Verde oscuro
  { val: 20.0, color: [255, 200, 0, 200] },      // Amarillo
  { val: 40.0, color: [200, 100, 0, 230] },      // Naranja oscuro
  { val: 70.0, color: [255, 150, 255, 255] },    // Rosa claro / Lila
  { val: 100.0, color: [150, 50, 200, 255] },    // Púrpura
  { val: 150.0, color: [50, 0, 100, 255] }       // Púrpura oscuro
];

export function buildSnowColorRampTexture(ramp) {
  const size = 256;
  const pixels = new Uint8Array(size * 4);
  const stopsCount = ramp.length;

  for (let i = 0; i < size; i++) {
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
