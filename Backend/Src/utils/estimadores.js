const { clamp } = require('./math');

/**
 * Estima la Calidad del Agua (ICA 0-100) a partir de:
 *  - humedad relativa (alta humedad → más arrastre de contaminantes)
 *  - AQI (contaminación del aire correlaciona con agua)
 *  - precipitación implícita en weather_code
 *  - ranges: { ica: [min, max] }
 */
function estimateICA(humedad, aqi, weatherCode, ranges) {
  const [iMin, iMax] = ranges.ica;

  const humNorm = clamp(humedad / 100, 0, 1);
  const aqiNorm = clamp(aqi / 200, 0, 1);
  const isRaining = weatherCode >= 51 && weatherCode <= 82;

  let icaEstimado = iMax - aqiNorm * (iMax - iMin) * 0.5
                      + humNorm * (iMax - iMin) * 0.1
                      - (isRaining ? 5 : 0);

  icaEstimado += (Math.random() - 0.5) * 6;

  return Number(clamp(icaEstimado, iMin, iMax).toFixed(1));
}

/**
 * Estima el nivel de Ruido (dB) basado en la hora del día.
 * Pico en hora punta (7-9h y 17-20h), silencio nocturno (0-6h).
 * ranges: { ruido: [min, max] }
 */
function estimateRuido(ranges) {
  const [rMin, rMax] = ranges.ruido;
  const hour = new Date().getHours();

  let factor;
  if (hour >= 0 && hour < 6)       factor = 0.15;
  else if (hour >= 6 && hour < 7)  factor = 0.35;
  else if (hour >= 7 && hour <= 9) factor = 0.85;
  else if (hour >= 10 && hour < 17) factor = 0.60;
  else if (hour >= 17 && hour <= 20) factor = 0.90;
  else if (hour >= 21 && hour < 23) factor = 0.45;
  else                              factor = 0.20;

  const ruido = rMin + factor * (rMax - rMin) + (Math.random() - 0.5) * 4;
  return Number(clamp(ruido, rMin, rMax).toFixed(1));
}

module.exports = { estimateICA, estimateRuido };
