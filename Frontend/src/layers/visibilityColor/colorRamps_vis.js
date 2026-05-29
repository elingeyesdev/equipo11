/**
 * colorRamps_vis.js — Paleta de colores continua para Visibilidad.
 * Implementa un gradiente suave mapeado por índices interpolados.
 */

export const VISIBILITY_RAMP_8 = [
  { val: 0.1, color: [160, 58, 0, 255] },       // 0/7: Naranja Óxido/Marrón cálido (#A03A00)
  { val: 0.5, color: [230, 92, 0, 255] },       // 1/7: Naranja Intenso (#E65C00)
  { val: 1.0, color: [255, 148, 77, 255] },     // 2/7: Naranja Claro/Brillante (#FF944D)
  { val: 2.0, color: [255, 170, 102, 255] },    // 3/7: Melocotón/Dorado suave (#FFAA66)
  { val: 3.0, color: [255, 204, 153, 255] },    // 4/7: Crema/Carioca claro (#FFCC99)
  { val: 5.0, color: [255, 230, 204, 255] },    // 5/7: Arena muy clara/Hueso (#FFE6CC)
  { val: 10.0, color: [240, 240, 240, 127] },   // 6/7: Blanco Grisáceo Translúcido (rgba(240, 240, 240, 0.5))
  { val: 20.0, color: [255, 255, 255, 0] }      // 7/7: Completamente Transparente (rgba(255, 255, 255, 0.0))
];

export const DEFAULT_VIS_RAMP = VISIBILITY_RAMP_8;

/**
 * Genera la textura de paleta 1D uniformemente distribuida según los índices,
 * permitiendo una transición sedosa en la textura de 256 píxeles.
 */
export function buildVisibilityColorRampTexture(ramp = DEFAULT_VIS_RAMP) {
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
