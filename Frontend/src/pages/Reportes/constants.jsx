export const CIUDADES = [
  'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro',
  'Potosí', 'Sucre', 'Tarija', 'Trinidad', 'Cobija',
];

export const METRICAS_OPTS = [
  { value: 'temperatura', label: 'Temperatura',      sufijo: '°C',   color: 'violet', icon: <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M11.5 6.5v6"/></svg> },
  { value: 'aqi',         label: 'Calidad del Aire', sufijo: ' AQI', color: 'rust',   icon: <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 14h16"/><path d="M4 10h16"/><path d="M4 18h16"/><path d="M4 6h16"/></svg> },
  { value: 'humedad',     label: 'Humedad',          sufijo: '%',    color: 'river',  icon: <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg> },
  { value: 'ruido',       label: 'Ruido',            sufijo: ' dB',  color: 'amber',  icon: <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> },
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
