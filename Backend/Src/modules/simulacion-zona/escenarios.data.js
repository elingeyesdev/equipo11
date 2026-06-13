/**
 * escenarios.data.js — Catálogo de escenarios de simulación por métrica.
 * 
 * Cada escenario vuelve a sus casos tradicionales (p. ej. Caso Frío, Caso Calor)
 * pero ahora posee la propiedad `niveles` (bajo, medio, alto) para modular
 * la intensidad de la simulación.
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
        curva: 'lineal',
        borderColor: '#3b82f6',
        niveles: {
          bajo: { inicio: 18, fin: 12, rangoLabel: '18 °C → 12 °C' },
          medio: { inicio: 8, fin: 2, rangoLabel: '8 °C → 2 °C' },
          alto: { inicio: 2, fin: -15, rangoLabel: '2 °C → -15 °C (Dispara Alarma)' }
        }
      },
      {
        id: 'calor',
        nombre: 'Caso Calor',
        descripcion: 'Ola de calor en valle · pico al mediodía',
        icon: '🌡️',
        iconBg: '#fee2e2',
        curva: 'pico',
        borderColor: '#ef4444',
        niveles: {
          bajo: { inicio: 22, fin: 26, rangoLabel: '22 °C → 26 °C' },
          medio: { inicio: 26, fin: 32, rangoLabel: '26 °C → 32 °C' },
          alto: { inicio: 28, fin: 43, rangoLabel: '28 °C → 43 °C (Dispara Alarma)' }
        }
      }
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
    descripcion: 'Índice de calidad del aire (PM2.5 / PM10). Simula episodios de contaminación atmosférica.',
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
        curva: 'exponencial',
        borderColor: '#ef4444',
        niveles: {
          bajo: { inicio: 15, fin: 45, rangoLabel: 'AQI 15 → 45' },
          medio: { inicio: 45, fin: 140, rangoLabel: 'AQI 45 → 140' },
          alto: { inicio: 50, fin: 320, rangoLabel: 'AQI 50 → 320 (Dispara Alarma)' }
        }
      },
      {
        id: 'estancamiento',
        nombre: 'Caso Estancamiento',
        descripcion: 'Inversión térmica en valle · gases acumulados sin dispersión',
        icon: '≡',
        iconBg: '#f3f4f6',
        curva: 'lineal',
        borderColor: '#6b7280',
        niveles: {
          bajo: { inicio: 20, fin: 45, rangoLabel: 'AQI 20 → 45' },
          medio: { inicio: 45, fin: 95, rangoLabel: 'AQI 45 → 95' },
          alto: { inicio: 60, fin: 180, rangoLabel: 'AQI 60 → 180 (Dispara Alarma)' }
        }
      }
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
    descripcion: 'Índice de calidad del agua. Modela contaminación química o bacteriológica.',
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
        curva: 'lineal',
        borderColor: '#f59e0b',
        niveles: {
          bajo: { inicio: 95, fin: 85, rangoLabel: 'ICA 95 → 85' },
          medio: { inicio: 80, fin: 60, rangoLabel: 'ICA 80 → 60' },
          alto: { inicio: 78, fin: 22, rangoLabel: 'ICA 78 → 22 (Dispara Alarma)' }
        }
      },
      {
        id: 'sequia',
        nombre: 'Caso Escasez / Sequía',
        descripcion: 'Caudal mínimo · sedimentos y contaminantes concentrados',
        icon: '≋',
        iconBg: '#f3f4f6',
        curva: 'lineal',
        borderColor: '#6b7280',
        niveles: {
          bajo: { inicio: 90, fin: 75, rangoLabel: 'ICA 90 → 75' },
          medio: { inicio: 72, fin: 55, rangoLabel: 'ICA 72 → 55' },
          alto: { inicio: 70, fin: 38, rangoLabel: 'ICA 70 → 38 (Dispara Alarma)' }
        }
      }
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
    descripcion: 'Nivel de presión sonora. Evalúa superación de umbrales de salud auditiva.',
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
        curva: 'pico',
        borderColor: '#f97316',
        niveles: {
          bajo: { inicio: 35, fin: 50, rangoLabel: '35 dB → 50 dB' },
          medio: { inicio: 50, fin: 68, rangoLabel: '50 dB → 68 dB' },
          alto: { inicio: 55, fin: 98, rangoLabel: '55 dB → 98 dB (Dispara Alarma)' }
        }
      },
      {
        id: 'construccion',
        nombre: 'Caso Construcción Nocturna',
        descripcion: 'Ruido base elevado en horas de descanso · fuera de norma',
        icon: '🔨',
        iconBg: '#f3f4f6',
        curva: 'lineal',
        borderColor: '#6b7280',
        niveles: {
          bajo: { inicio: 30, fin: 45, rangoLabel: '30 dB → 45 dB' },
          medio: { inicio: 45, fin: 60, rangoLabel: '45 dB → 60 dB' },
          alto: { inicio: 40, fin: 88, rangoLabel: '40 dB → 88 dB (Dispara Alarma)' }
        }
      }
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
    descripcion: 'Humedad relativa del aire. Mide sequedad extrema y saturación.',
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
        curva: 'lineal',
        borderColor: '#06b6d4',
        niveles: {
          bajo: { inicio: 45, fin: 65, rangoLabel: '45 % → 65 %' },
          medio: { inicio: 60, fin: 79, rangoLabel: '60 % → 79 %' },
          alto: { inicio: 68, fin: 98, rangoLabel: '68 % → 98 % (Dispara Alarma)' }
        }
      },
      {
        id: 'sequia',
        nombre: 'Caso Sequedad Crítica',
        descripcion: 'Caída por debajo del 15% · alto riesgo de incendio forestal',
        icon: '☀️',
        iconBg: '#f3f4f6',
        curva: 'lineal',
        borderColor: '#6b7280',
        niveles: {
          bajo: { inicio: 45, fin: 35, rangoLabel: '45 % → 35 %' },
          medio: { inicio: 35, fin: 20, rangoLabel: '35 % → 20 %' },
          alto: { inicio: 35, fin: 8, rangoLabel: '35 % → 8 % (Dispara Alarma)' }
        }
      }
    ],
  },
];
