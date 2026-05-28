import { useUmbrales, colorPorValor } from '../../hooks/useUmbrales'
import { getIcon } from '../../utils/metricIcons'

const METRIC_CONFIG = {
  temperatura: { label: 'Temperatura', unit: '°C', accent: 'var(--rust)' },
  aqi: { label: 'Calidad del Aire', unit: 'AQI', accent: 'var(--moss)' },
  ica: { label: 'ICA', unit: '', accent: 'var(--moss)' },
  humedad: { label: 'Humedad', unit: '%', accent: 'var(--river)' },
  ruido: { label: 'Ruido', unit: 'dB', accent: 'var(--amber)' },
}

function formatValue(v) {
  if (v == null || (typeof v === 'number' && isNaN(v))) return '--'
  if (typeof v === 'string') return v
  return Number(v).toFixed(1)
}

export default function QuickMetricCard({ metric, value }) {
  const config = METRIC_CONFIG[metric]
  const { umbrales } = useUmbrales(metric)

  if (!config) return null

  const displayValue = formatValue(value)
  const isEmpty = displayValue === '--'
  const numericVal = !isEmpty ? Number(value) : NaN
  const riskColor =
    umbrales.length > 0 && !isNaN(numericVal)
      ? colorPorValor(umbrales, numericVal)
      : null
  const accentColor = riskColor || config.accent

  return (
    <div
      className="mobile-metric-card"
      style={{ '--card-accent': accentColor, borderLeftColor: accentColor }}
    >
      <span className="mobile-metric-icon">{getIcon(metric)}</span>
      <div className="mobile-metric-body">
        <span className="mobile-metric-label">{config.label}</span>
        <div className="mobile-metric-row">
          <span className={`mobile-metric-value ${isEmpty ? 'mobile-metric-empty' : ''}`}>
            {displayValue}
          </span>
          {config.unit && !isEmpty && (
            <span className="mobile-metric-unit">{config.unit}</span>
          )}
          {isEmpty && <span className="mobile-metric-na">sin datos</span>}
        </div>
      </div>
    </div>
  )
}
