/**
 * colorRamps.js — Paletas de color para la capa de velocidad del viento.
 *
 * Principio Open/Closed: se pueden agregar nuevas paletas sin
 * modificar el shader ni la clase WindColorLayer.
 * Cada stop define un umbral de velocidad (km/h) y su color RGBA [0-1].
 */

// Escala de colores sincronizada con el Popup
export const WINDY_RAMP = [
  { stop: 0,   color: [51,  51, 255, 255] },
  { stop: 10,  color: [70, 130, 180, 255] },
  { stop: 20,  color: [46, 139,  87, 255] },
  { stop: 30,  color: [0,  255,   0, 255] },
  { stop: 40,  color: [173, 255,  47, 255] },
  { stop: 50,  color: [255, 255,   0, 255] },
  { stop: 60,  color: [255, 204,   0, 255] },
  { stop: 70,  color: [255, 136,   0, 255] },
  { stop: 80,  color: [255,  69,   0, 255] },
  { stop: 100, color: [139,   0,   0, 255] },
  { stop: 120, color: [255,   0, 255, 255] },
  { stop: 140, color: [255, 182, 193, 255] }
];

export const DEFAULT_RAMP = WINDY_RAMP;

/**
 * Genera un array RGBA de 256 colores interpolando linealmente por valor.
 */
export function buildColorRampTexture(ramp = DEFAULT_RAMP, maxSpeed = 140.0) {
  const size = 256;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const speed = (i / (size - 1)) * maxSpeed;

    let lo = ramp[0];
    let hi = ramp[ramp.length - 1];

    for (let j = 0; j < ramp.length - 1; j++) {
      if (speed >= ramp[j].stop && speed <= ramp[j + 1].stop) {
        lo = ramp[j];
        hi = ramp[j + 1];
        break;
      }
    }

    const range = hi.stop - lo.stop;
    const t = range > 0 ? Math.min(1, Math.max(0, (speed - lo.stop) / range)) : 0;

    pixels[i * 4 + 0] = Math.round(lo.color[0] + t * (hi.color[0] - lo.color[0]));
    pixels[i * 4 + 1] = Math.round(lo.color[1] + t * (hi.color[1] - lo.color[1]));
    pixels[i * 4 + 2] = Math.round(lo.color[2] + t * (hi.color[2] - lo.color[2]));
    pixels[i * 4 + 3] = Math.round(lo.color[3] + t * (hi.color[3] - lo.color[3]));
  }

  return pixels;
}
