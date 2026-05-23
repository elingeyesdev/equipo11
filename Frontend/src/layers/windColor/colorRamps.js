/**
 * colorRamps.js — Paletas de color para la capa de velocidad del viento.
 *
 * Principio Open/Closed: se pueden agregar nuevas paletas sin
 * modificar el shader ni la clase WindColorLayer.
 * Cada stop define un umbral de velocidad (km/h) y su color RGBA [0-1].
 */

// Escala de colores vibrante al estilo de la imagen de referencia (Windy)
// Alpha 1.0 en todos para cubrir el mapa base sin verse afectado por el modo claro/oscuro
export const WINDY_RAMP = [
  { stop: 0,   color: [50/255,  80/255,  160/255, 1.0] },  // Azul profundo (calma)
  { stop: 10,  color: [60/255,  120/255, 200/255, 1.0] },  // Azul medio
  { stop: 20,  color: [70/255,  200/255, 150/255, 1.0] },  // Verde azulado / Cian
  { stop: 30,  color: [100/255, 255/255,  80/255, 1.0] },  // Verde vibrante (viento moderado)
  { stop: 40,  color: [200/255, 255/255,  50/255, 1.0] },  // Verde-Amarillo
  { stop: 50,  color: [255/255, 220/255,  40/255, 1.0] },  // Amarillo
  { stop: 60,  color: [255/255, 140/255,   0/255, 1.0] },  // Naranja
  { stop: 80,  color: [255/255,  50/255,  50/255, 1.0] },  // Rojo
  { stop: 100, color: [200/255,  20/255, 100/255, 1.0] },  // Magenta
];

export const DEFAULT_RAMP = WINDY_RAMP;

/**
 * Genera un array RGBA de 256 colores interpolando linealmente
 * entre los stops de la paleta.
 *
 * @param {Array} ramp     — Array de { stop, color } ordenado por stop ascendente
 * @param {number} maxSpeed — Velocidad máxima del rango en km/h (default 150)
 * @returns {Uint8Array}   — 256 × 4 bytes (RGBA), listo para subir como textura
 */
export function buildColorRampTexture(ramp = DEFAULT_RAMP, maxSpeed = 150) {
  const size = 256;
  const pixels = new Uint8Array(size * 4);

  for (let i = 0; i < size; i++) {
    const speed = (i / (size - 1)) * maxSpeed;

    // Encontrar los dos stops que encierran esta velocidad
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

    const r = lo.color[0] + t * (hi.color[0] - lo.color[0]);
    const g = lo.color[1] + t * (hi.color[1] - lo.color[1]);
    const b = lo.color[2] + t * (hi.color[2] - lo.color[2]);
    const a = lo.color[3] + t * (hi.color[3] - lo.color[3]);

    pixels[i * 4 + 0] = Math.round(r * 255);
    pixels[i * 4 + 1] = Math.round(g * 255);
    pixels[i * 4 + 2] = Math.round(b * 255);
    pixels[i * 4 + 3] = Math.round(a * 255);
  }

  return pixels;
}
