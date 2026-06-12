export const CIUDADES = [
  'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro',
  'Potosí', 'Sucre', 'Tarija', 'Trinidad', 'Cobija',
];

export const METRICAS_OPTS = [
  { value: 'temperatura', label: 'Temperatura',      sufijo: '°C',   color: 'violet',  icon: '🌡' },
  { value: 'aqi',         label: 'Calidad del Aire', sufijo: ' AQI', color: 'rust',    icon: '🌫' },
  { value: 'humedad',     label: 'Humedad',          sufijo: '%',    color: 'river',   icon: '💧' },
  { value: 'ruido',       label: 'Ruido',            sufijo: ' dB',  color: 'amber',   icon: '🔊' },
  { value: 'windSpeed',   label: 'Viento',           sufijo: ' km/h',color: 'moss',    icon: '🌬' },
  { value: 'rain',        label: 'Lluvia',           sufijo: ' mm/h', color: 'climate', icon: '🌧' },
];

export const RANGOS = [
  { label: '24 h', dias: 1 },
  { label: '7 d',  dias: 7 },
  { label: '30 d', dias: 30 },
  { label: 'Todo', dias: null },
];

export const PAGE_SIZE = 15;

export function calcStats(datos, key) {
  const vals = datos.map(d => d[key]).filter(v => v != null && !isNaN(v));
  if (!vals.length) return { avg: null, min: null, max: null };
  const sum = vals.reduce((a, b) => a + b, 0);
  return { avg: sum / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
}
