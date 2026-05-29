/**
 * Convierte concentración de PM2.5 (µg/m³) a índice AQI (EPA).
 * Utiliza interpolación lineal por tramos (breakpoints).
 * 
 * @param {number} pm - Concentración de PM2.5 en µg/m³
 * @returns {number} Índice AQI (0 - 500)
 */
function pm25ToAqi(pm) {
  // Breakpoints: [PM2.5, AQI]
  const bp = [
    [0.0, 0], 
    [12.0, 50], 
    [35.4, 100], 
    [55.4, 150],
    [150.4, 200], 
    [250.4, 300], 
    [500.4, 500],
  ];
  const v = Math.max(0, pm);
  
  for (let i = 0; i < bp.length - 1; i++) {
    const [p0, a0] = bp[i];
    const [p1, a1] = bp[i + 1];
    if (v <= p1) {
      return Math.round(a0 + ((v - p0) / (p1 - p0)) * (a1 - a0));
    }
  }
  return 500; // Valor máximo capado
}

module.exports = { pm25ToAqi };
