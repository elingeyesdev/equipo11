// Conversión AQI (EPA) → PM2.5 µg/m³ (interpolación lineal por tramos)
function aqiToPm25(aqi) {
  const bp = [
    [0, 0.0], [50, 12.0], [100, 35.4], [150, 55.4],
    [200, 150.4], [300, 250.4], [500, 500.4],
  ]
  const v = Math.max(0, Math.min(500, aqi))
  for (let i = 0; i < bp.length - 1; i++) {
    const [a0, p0] = bp[i], [a1, p1] = bp[i + 1]
    if (v <= a1) return p0 + ((v - a0) / (a1 - a0)) * (p1 - p0)
  }
  return 500.4
}

// Inversa: PM2.5 µg/m³ → AQI (EPA)
function pm25ToAqi(pm) {
  const bp = [
    [0.0, 0], [12.0, 50], [35.4, 100], [55.4, 150],
    [150.4, 200], [250.4, 300], [500.4, 500],
  ]
  const v = Math.max(0, pm)
  for (let i = 0; i < bp.length - 1; i++) {
    const [p0, a0] = bp[i], [p1, a1] = bp[i + 1]
    if (v <= p1) return a0 + ((v - p0) / (p1 - p0)) * (a1 - a0)
  }
  return 500
}

export const METRICAS_UNIDADES = {
  temperatura: {
    label: 'Temperatura', icon: '🌡️',
    unidades: [
      { key: 'C', label: '°C — Celsius',    convertir: v => v,             invertir: v => v,                  precision: 1, sufijo: '°C' },
      { key: 'F', label: '°F — Fahrenheit', convertir: v => v * 9 / 5 + 32, invertir: v => (v - 32) * 5 / 9, precision: 1, sufijo: '°F' },
      { key: 'K', label: 'K — Kelvin',      convertir: v => v + 273.15,    invertir: v => v - 273.15,         precision: 2, sufijo: ' K'  },
    ],
    defecto: 'C',
  },
  aqi: {
    label: 'Calidad del Aire', icon: '🌫️',
    unidades: [
      { key: 'AQI',  label: 'AQI — Índice EPA',  convertir: v => v,        invertir: v => v,       precision: 0, sufijo: ' AQI'   },
      { key: 'PM25', label: 'µg/m³ — PM2.5',     convertir: aqiToPm25,    invertir: pm25ToAqi,    precision: 1, sufijo: ' µg/m³' },
    ],
    defecto: 'AQI',
  },
  ica: {
    label: 'Calidad del Agua', icon: '💧',
    unidades: [
      { key: 'ICA', label: 'ICA (0–100)', convertir: v => v, invertir: v => v, precision: 0, sufijo: ' ICA' },
    ],
    defecto: 'ICA',
  },
  ruido: {
    label: 'Nivel de Ruido', icon: '🔊',
    unidades: [
      { key: 'dB', label: 'dB — Decibeles', convertir: v => v, invertir: v => v, precision: 0, sufijo: ' dB' },
    ],
    defecto: 'dB',
  },
  humedad: {
    label: 'Humedad', icon: '💦',
    unidades: [
      { key: '%', label: '% — Relativa', convertir: v => v, invertir: v => v, precision: 0, sufijo: '%' },
    ],
    defecto: '%',
  },
}

function resolverUnidad(metricKey, unitKey) {
  const cfg = METRICAS_UNIDADES[metricKey]
  if (!cfg) return null
  return cfg.unidades.find(u => u.key === unitKey) ?? cfg.unidades[0]
}

export function formatearValor(metricKey, rawValue, unitKey) {
  const unit = resolverUnidad(metricKey, unitKey)
  if (!unit || rawValue == null || typeof rawValue !== 'number' || isNaN(rawValue)) return '—'
  return `${unit.convertir(rawValue).toFixed(unit.precision)}${unit.sufijo}`
}

export function convertirValor(metricKey, rawValue, unitKey) {
  const unit = resolverUnidad(metricKey, unitKey)
  if (!unit || rawValue == null || rawValue === '') return rawValue
  return unit.convertir(Number(rawValue))
}

export function invertirValor(metricKey, displayValue, unitKey) {
  const unit = resolverUnidad(metricKey, unitKey)
  if (!unit || displayValue == null || displayValue === '') return displayValue
  return unit.invertir(Number(displayValue))
}
