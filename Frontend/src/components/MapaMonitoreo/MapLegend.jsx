import React, { useState } from 'react';
import './MapLegend.css';

const LEGENDS = {
  temp: {
    label: 'Temperatura',
    labels: ['-50°', '-30°', '-10°', '0°', '15°', '35°', '45°'],
    gradient: 'linear-gradient(to right, #e6e6fa, #9999ff, #4a0080, #00ff00, #ffff00, #ff0000, #800000)'
  },
  rain: {
    label: 'Precipitación',
    labels: ['0', '0.1', '2', '10', '20+ mm/h'],
    gradient: 'linear-gradient(to right, rgba(0,255,255,0.3), #00ffff, #0000ff, #800080, #ff00ff)'
  },
  snow: {
    label: 'Nieve',
    labels: ['0', '15', '50', '100', '150+ cm'],
    gradient: 'linear-gradient(to right, #ffffff, #aeefff, #3fd4f5, #1793d1, #400c70)'
  },
  wind: {
    label: 'Viento',
    labels: ['0', '30', '60', '100', '140+ km/h'],
    gradient: 'linear-gradient(to right, #3333ff, #00ff00, #ffcc00, #8b0000, #ffb6c1)'
  },
  fog: {
    label: 'Visibilidad',
    labels: ['0', '1', '2', '5', '10', '20+ km'],
    gradient: 'linear-gradient(to right, #8b4513, #d2691e, #f4a460, #f5deb3, rgba(240,240,240,0.5), transparent)'
  },
  aqi: {
    label: 'Calidad del Aire (AQI)',
    labels: ['0', '50', '100', '150', '200', '300', '500'],
    gradient: 'linear-gradient(to right, #e0f2ff, #7dd3ff, #00e400, #ffff00, #ff7e00, #ff0000, #8f3f97, #7e0023)'
  }
};

export default function MapLegend({ isParticlesActive, particleFilters }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Determinar qué leyenda mostrar
  let activeLegendKey = null;
  if (isParticlesActive && particleFilters) {
    // Prioridad de visualización
    const priority = ['aqi', 'temp', 'rain', 'snow', 'wind', 'fog'];
    for (const key of priority) {
      if (particleFilters[key]) {
        activeLegendKey = key;
        break;
      }
    }
  }

  if (!activeLegendKey) return null;

  const legend = LEGENDS[activeLegendKey];

  if (isCollapsed) {
    return (
      <button 
        className="map-legend-collapsed-btn" 
        onClick={() => setIsCollapsed(false)}
        title="Mostrar Leyenda"
      >
        📖
      </button>
    );
  }

  return (
    <div className="map-legend-container">
      <div className="map-legend-header">
        <span className="map-legend-title">{legend.label}</span>
        <button 
          className="map-legend-close" 
          onClick={() => setIsCollapsed(true)}
          title="Ocultar"
        >
          ×
        </button>
      </div>
      <div className="map-legend-body">
        <div 
          className="map-legend-gradient" 
          style={{ background: legend.gradient }} 
        />
        <div className="map-legend-labels">
          {legend.labels.map((lbl, idx) => (
            <span key={idx}>{lbl}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
