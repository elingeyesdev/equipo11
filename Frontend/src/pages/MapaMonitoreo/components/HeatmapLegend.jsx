import React, { useState } from 'react'
import { useUmbrales } from '../../../hooks/useUmbrales'
import Draggable from '../../../components/Draggable/Draggable'
import { convertirValor, METRICAS_UNIDADES } from '../../../utils/unidades'

/**
 * Leyenda contextual del heatmap activo.
 * Se autoactiva cuando el heatmap está ON.
 *
 * Props:
 *   metrica      {string}   - clave activa ("aqi", "temperatura", "ica", "ruido", "humedad")
 *   onRangeClick {Function} - callback(umbral|null) para filtrar el mapa
 *   visible      {boolean}  - mostrar/ocultar la leyenda
 *   onClose      {Function} - callback para apagar la capa
 *   unidad       {string}   - unidad activa (ej: 'C', 'F', 'AQI')
 */
export default function HeatmapLegend({ metrica, onRangeClick, visible, onClose, unidad }) {
  const metricQuery = metrica;
  
  const { umbrales: dbUmbrales, loading } = useUmbrales(metricQuery)
  const [activeRange, setActiveRange] = useState(null)
  const [isMinimized, setIsMinimized] = useState(false)

  if (!visible) return null

  // Encontrar el sufijo de unidad activa
  const unitConfig = METRICAS_UNIDADES[metrica]?.unidades.find(u => u.key === unidad) || METRICAS_UNIDADES[metrica]?.unidades[0]
  const sufijo = unitConfig ? unitConfig.sufijo.trim() : ''

  // Título amigable por métrica (incluyendo la unidad dinámicamente)
  const titulos = {
    aqi:        `Calidad del Aire (${sufijo || 'AQI'})`,
    temperatura:`Temperatura (${sufijo || '°C'})`,
    ica:        `Calidad del Agua (${sufijo || 'ICA'})`,
    ruido:      `Nivel de Ruido (${sufijo || 'dB'})`,
    humedad:    `Humedad Relativa (${sufijo || '%'})`,
  }

  // Fallbacks visuales estáticos si el backend falla o está cargando, 
  // diseñados exactamente como los mapas de clima profesionales
  const fallbackScales = {
    temperatura: [
      { nivel: 1, valor_min: -40, color_hex: '#ff99ff', label: 'Extremo' },
      { nivel: 2, valor_min: -30, color_hex: '#cc00cc', label: 'Muy Frío' },
      { nivel: 3, valor_min: -20, color_hex: '#6600cc', label: 'Frío' },
      { nivel: 4, valor_min: -10, color_hex: '#0066ff', label: 'Helado' },
      { nivel: 5, valor_min: 0,   color_hex: '#33ccff', label: 'Punto Congelación' },
      { nivel: 6, valor_min: 10,  color_hex: '#00cc66', label: 'Fresco' },
      { nivel: 7, valor_min: 20,  color_hex: '#ccff33', label: 'Templado' },
      { nivel: 8, valor_min: 30,  color_hex: '#ff9900', label: 'Cálido' },
      { nivel: 9, valor_min: 40,  color_hex: '#cc0000', label: 'Calor' },
      { nivel: 10, valor_min: 50, color_hex: '#660000', label: 'Extremo' },
    ],
    aqi: [
      { nivel: 1, valor_min: 0,   color_hex: '#00e400', label: 'Bueno' },
      { nivel: 2, valor_min: 50,  color_hex: '#ffff00', label: 'Moderado' },
      { nivel: 3, valor_min: 100, color_hex: '#ff7e00', label: 'Dañino Sensibles' },
      { nivel: 4, valor_min: 150, color_hex: '#ff0000', label: 'Dañino' },
      { nivel: 5, valor_min: 200, color_hex: '#8f3f97', label: 'Muy Dañino' },
      { nivel: 6, valor_min: 300, color_hex: '#7e0023', label: 'Peligroso' },
    ],
    ica: [
      { nivel: 1, valor_min: 0,  color_hex: '#6d4c41', label: 'Muy mala' },
      { nivel: 2, valor_min: 26, color_hex: '#f57c00', label: 'Mala' },
      { nivel: 3, valor_min: 51, color_hex: '#fbc02d', label: 'Regular' },
      { nivel: 4, valor_min: 71, color_hex: '#1976d2', label: 'Buena' },
      { nivel: 5, valor_min: 91, color_hex: '#0d47a1', label: 'Excelente' },
    ],
    ruido: [
      { nivel: 1, valor_min: 0,   color_hex: '#1a9850', label: 'Silencio' },
      { nivel: 2, valor_min: 30,  color_hex: '#91cf60', label: 'Tranquilo' },
      { nivel: 3, valor_min: 55,  color_hex: '#ffffbf', label: 'Moderado' },
      { nivel: 4, valor_min: 70,  color_hex: '#fc8d59', label: 'Ruidoso' },
      { nivel: 5, valor_min: 85,  color_hex: '#d73027', label: 'Dañino' },
      { nivel: 6, valor_min: 100, color_hex: '#7f0000', label: 'Peligroso' },
    ],
    humedad: [
      { nivel: 1, valor_min: 0,  color_hex: '#fdae61', label: 'Muy seco' },
      { nivel: 2, valor_min: 20, color_hex: '#fee090', label: 'Seco' },
      { nivel: 3, valor_min: 40, color_hex: '#abd9e9', label: 'Confortable' },
      { nivel: 4, valor_min: 60, color_hex: '#74add1', label: 'Húmedo' },
      { nivel: 5, valor_min: 80, color_hex: '#313695', label: 'Muy húmedo' },
    ]
  };

  const currentUmbrales = dbUmbrales.length > 0 ? dbUmbrales : (fallbackScales[metrica] || fallbackScales.temperatura);

  const handleRangeClick = (umbral) => {
    const next = activeRange?.nivel === umbral.nivel ? null : umbral
    setActiveRange(next)
    onRangeClick?.(next)
  }

  return (
    <Draggable className="heatmap-legend" style={styles.container}>
      <div style={styles.topBar}>
        <span style={styles.legendTitle}>LEYENDA</span>
        <div style={styles.windowControls}>
          <button 
            onClick={() => setIsMinimized(!isMinimized)} 
            style={styles.actionBtn}
            title={isMinimized ? "Maximizar leyenda" : "Minimizar leyenda"}
          >
            {isMinimized ? '＋' : '－'}
          </button>
          <button 
            onClick={onClose} 
            style={styles.actionBtn}
            title="Cerrar mapa de calor"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={styles.header}>
        <span style={styles.metricTitle}>{titulos[metrica] ?? metrica}</span>
      </div>

      {!isMinimized && (
        <div style={styles.colorBarContainer}>
          {currentUmbrales.map((u, index) => {
            // Convertir el valor a la unidad seleccionada
            const convertedValue = convertirValor(metrica, u.valor_min, unidad);
            // Redondear para evitar decimales infinitos en la leyenda
            const displayValue = convertedValue != null ? Math.round(convertedValue) : u.valor_min;

            return (
              <div
                key={u.nivel}
                onClick={() => handleRangeClick(u)}
                title={`${u.label} (Clic para filtrar)`}
                style={{
                  ...styles.colorSegment,
                  backgroundColor: u.color_hex,
                  opacity: activeRange && activeRange.nivel !== u.nivel ? 0.35 : 1,
                  transform: activeRange?.nivel === u.nivel ? 'scaleY(1.3)' : 'scaleY(1)',
                  zIndex: activeRange?.nivel === u.nivel ? 2 : 1,
                }}
              >
                <span style={styles.segmentValue}>{displayValue}</span>
              </div>
            )
          })}
        </div>
      )}
    </Draggable>
  )
}

const styles = {
  container: {
    position: 'absolute',
    bottom: '2rem',
    left: '4rem',
    // Diseño tipo "glass" integrado en el mapa (sin el cuadro negro opaco)
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    borderRadius: '8px',
    padding: '0.8rem 1rem',
    minWidth: 'auto',
    width: 'calc(100vw - 2rem)',
    maxWidth: '380px',
    zIndex: 10,
    fontFamily: 'inherit',
    border: 'none',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.8rem',
  },
  legendTitle: {
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
  },
  windowControls: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0 4px',
    textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '0.4rem',
  },
  metricTitle: {
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
  },
  colorBarContainer: {
    display: 'flex',
    height: '24px',
    width: '100%',
    alignItems: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
  },
  colorSegment: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s ease',
    minWidth: '28px',
  },
  segmentValue: {
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: '700',
    textShadow: '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.6)',
    pointerEvents: 'none',
  }
}
