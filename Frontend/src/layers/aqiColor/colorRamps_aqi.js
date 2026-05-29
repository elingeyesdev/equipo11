/**
 * colorRamps_aqi.js
 * Genera la textura 1D (256x1) para la paleta de colores de AQI (EPA Standard).
 */

export function buildAqiColorRampTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const gradient = ctx.createLinearGradient(0, 0, 256, 0);

  // EPA Standard Breakpoints (Normalizados de 0 a 500)
  // 0.00 - 0.10 (0-50): Bueno
  gradient.addColorStop(0.00, '#00E400');
  gradient.addColorStop(0.10, '#00E400');
  
  // 0.10 - 0.20 (51-100): Moderado
  gradient.addColorStop(0.1001, '#FFFF00');
  gradient.addColorStop(0.20, '#FFFF00');

  // 0.20 - 0.30 (101-150): Dañino para grupos sensibles
  gradient.addColorStop(0.2001, '#FF7E00');
  gradient.addColorStop(0.30, '#FF7E00');

  // 0.30 - 0.40 (151-200): Dañino
  gradient.addColorStop(0.3001, '#FF0000');
  gradient.addColorStop(0.40, '#FF0000');

  // 0.40 - 0.60 (201-300): Muy Dañino
  gradient.addColorStop(0.4001, '#8F3F97');
  gradient.addColorStop(0.60, '#8F3F97');

  // 0.60 - 1.00 (301-500): Peligroso
  gradient.addColorStop(0.6001, '#7E0023');
  gradient.addColorStop(1.00, '#7E0023');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);

  const imgData = ctx.getImageData(0, 0, 256, 1);
  return new Uint8Array(imgData.data.buffer);
}
