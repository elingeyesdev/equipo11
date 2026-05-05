/**
 * escenarios.data.js — Catálogo de escenarios de simulación por métrica.
 *
 * Cada escenario define:
 *  - id / nombre / descripcion / icon (emoji)
 *  - inicio / fin: valores extremos del escenario
 *  - curva: 'lineal' | 'exponencial' | 'pico'
 *  - rangoLabel: texto corto para la UI
 *
 * Las curvas de generación de datos se aplican en simulacion-zona.service.js.
 */

module.exports = [
  // ─────────────────────────────────────────────────────────────
  // 01 · TEMPERATURA
  // ─────────────────────────────────────────────────────────────
  {
    metricaClave: 'temperatura',
    numero: '01',
    nombre: 'Temperatura',
    unidad: '°C',
    categoria: 'Térmica',
    categoriaColor: '#3b82f6',
    descripcion: 'Genera lecturas térmicas extremas para validar alertas de frío y calor en estaciones de monitoreo.',
    iconCategoria: '🌡️',
    defaultDias: 1,
    defaultIntervalMin: 60,
    defaultIntervalSimSeg: 5,
    escenarios: [
      {
        id: 'frio',
        nombre: 'Caso Frío',
        descripcion: 'Helada andina sostenida · drop progresivo',
        icon: '❄️',
        iconBg: '#dbeafe',
        inicio: 2,
        fin: -10,
        curva: 'lineal',
        rangoLabel: '-10 °C → 2 °C',
        borderColor: '#3b82f6',
      },
      {
        id: 'calor',
        nombre: 'Caso Calor',
        descripcion: 'Ola de calor en valle · pico al mediodía',
        icon: '🌡️',
        iconBg: '#fee2e2',
        inicio: 28,
        fin: 41,
        curva: 'pico',
        rangoLabel: '28 °C → 41 °C',
        borderColor: '#ef4444',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 02 · CALIDAD DEL AIRE (AQI)
  // ─────────────────────────────────────────────────────────────
  {
    metricaClave: 'aqi',
    numero: '02',
    nombre: 'Aire',
    subtitulo: 'AQI',
    unidad: 'AQI',
    categoria: 'Atmósfera',
    categoriaColor: '#22c55e',
    descripcion: 'Índice de calidad del aire (PM2.5 / PM10). Simula episodios de contaminación atmosférica típicos en Bolivia.',
    iconCategoria: '🌫️',
    defaultDias: 5,
    defaultIntervalMin: 30,
    defaultIntervalSimSeg: 2,
    escenarios: [
      {
        id: 'incendio',
        nombre: 'Caso Incendio / Chaqueo',
        descripcion: 'Aumento drástico de PM2.5 · niveles peligrosos sostenidos',
        icon: '🔥',
        iconBg: '#fee2e2',
        inicio: 50,
        fin: 320,
        curva: 'exponencial',
        rangoLabel: 'AQI 50 → 320',
        borderColor: '#ef4444',
      },
      {
        id: 'estancamiento',
        nombre: 'Caso Estancamiento',
        descripcion: 'Inversión térmica en valle · gases acumulados sin dispersión',
        icon: '≡',
        iconBg: '#f3f4f6',
        inicio: 60,
        fin: 180,
        curva: 'lineal',
        rangoLabel: 'AQI 60 → 180',
        borderColor: '#6b7280',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 03 · CALIDAD DEL AGUA (ICA)
  // ─────────────────────────────────────────────────────────────
  {
    metricaClave: 'ica',
    numero: '03',
    nombre: 'Agua',
    subtitulo: 'ICA',
    unidad: 'ICA',
    categoria: 'Hídrica',
    categoriaColor: '#f59e0b',
    descripcion: 'Índice de calidad del agua. Modela contaminación química, bacteriológica o concentración por bajo caudal.',
    iconCategoria: '💧',
    defaultDias: 14,
    defaultIntervalMin: 60,
    defaultIntervalSimSeg: 5,
    escenarios: [
      {
        id: 'vertido',
        nombre: 'Caso Vertido Industrial',
        descripcion: 'Caída súbita del ICA · metales pesados y químicos',
        icon: '💧',
        iconBg: '#fef3c7',
        inicio: 78,
        fin: 22,
        curva: 'lineal',
        rangoLabel: 'ICA 78 → 22',
        borderColor: '#f59e0b',
      },
      {
        id: 'sequia',
        nombre: 'Caso Escasez / Sequía',
        descripcion: 'Caudal mínimo · sedimentos y contaminantes concentrados',
        icon: '≋',
        iconBg: '#f3f4f6',
        inicio: 70,
        fin: 38,
        curva: 'lineal',
        rangoLabel: 'ICA 70 → 38',
        borderColor: '#6b7280',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 04 · RUIDO (dB)
  // ─────────────────────────────────────────────────────────────
  {
    metricaClave: 'ruido',
    numero: '04',
    nombre: 'Ruido',
    subtitulo: 'dB',
    unidad: 'dB',
    categoria: 'Acústica',
    categoriaColor: '#f97316',
    descripcion: 'Nivel de presión sonora. Evalúa superación de umbrales de salud auditiva (65–70 dB diurno · 55 dB nocturno).',
    iconCategoria: '🔊',
    defaultDias: 3,
    defaultIntervalMin: 15,
    defaultIntervalSimSeg: 1,
    escenarios: [
      {
        id: 'manifestacion',
        nombre: 'Caso Manifestación',
        descripcion: 'Picos sostenidos sobre 90 dB · zona residencial / institucional',
        icon: '📢',
        iconBg: '#ffedd5',
        inicio: 55,
        fin: 98,
        curva: 'pico',
        rangoLabel: '55 dB → 98 dB',
        borderColor: '#f97316',
      },
      {
        id: 'construccion',
        nombre: 'Caso Construcción Nocturna',
        descripcion: 'Ruido base elevado en horas de descanso · fuera de norma',
        icon: '🔨',
        iconBg: '#f3f4f6',
        inicio: 40,
        fin: 78,
        curva: 'lineal',
        rangoLabel: '40 dB → 78 dB',
        borderColor: '#6b7280',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 05 · HUMEDAD (%)
  // ─────────────────────────────────────────────────────────────
  {
    metricaClave: 'humedad',
    numero: '05',
    nombre: 'Humedad',
    subtitulo: '%',
    unidad: '%',
    categoria: 'Higrometría',
    categoriaColor: '#06b6d4',
    descripcion: 'Humedad relativa del aire. El riesgo aparece en ambos extremos: saturación favorece moho e inundaciones; sequedad extrema dispara incendios y deshidratación.',
    iconCategoria: '💦',
    defaultDias: 10,
    defaultIntervalMin: 60,
    defaultIntervalSimSeg: 3,
    escenarios: [
      {
        id: 'saturacion',
        nombre: 'Caso Saturación',
        descripcion: 'Humedad cercana al 100% persistente · riesgo de moho e inundación',
        icon: '💧',
        iconBg: '#dbeafe',
        inicio: 68,
        fin: 98,
        curva: 'lineal',
        rangoLabel: '68 % → 98 %',
        borderColor: '#06b6d4',
      },
      {
        id: 'sequia',
        nombre: 'Caso Sequedad Crítica',
        descripcion: 'Caída por debajo del 15% · alto riesgo de incendio forestal',
        icon: '☀️',
        iconBg: '#f3f4f6',
        inicio: 35,
        fin: 8,
        curva: 'lineal',
        rangoLabel: '35 % → 8 %',
        borderColor: '#6b7280',
      },
    ],
  },
];
