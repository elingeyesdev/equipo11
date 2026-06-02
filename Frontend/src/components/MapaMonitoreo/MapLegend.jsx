import React, { useState } from 'react';
import './MapLegend.css';

const LEGENDS = {
  temp: {
    label: 'Temperatura',
    min: '-50°C',
    max: '50°C',
    gradient: 'linear-gradient(to right, #4a0080, #0000ff, #00ffff, #00ff00, #ffff00, #ff8800, #ff0000, #800000)'
  },
  rain: {
    label: 'Precipitación',
    min: '0 mm/h',
    max: '50+ mm/h',
    gradient: 'linear-gradient(to right, rgba(0,255,255,0.3), #00ffff, #0000ff, #800080, #ff00ff)'
  },
  snow: {
    label: 'Nieve',
    min: '0 cm',
    max: '50+ cm',
    gradient: 'linear-gradient(to right, rgba(255,255,255,0.2), #ffffff, #00ffff)'
  },
  wind: {
    label: 'Viento',
    min: '0 km/h',
    max: '250 km/h',
    gradient: 'linear-gradient(to right, rgba(255,255,255,0.1), #ffff00, #ff8800, #ff0000, #800080)'
  },
  fog: {
    label: 'Visibilidad',
    min: '0 km (Mala)',
    max: '20+ km (Buena)',
    gradient: 'linear-gradient(to right, #8b4513, #808080, rgba(255,255,255,0.1))'
  },
  aqi: {
    label: 'Calidad del Aire (AQI)',
    min: '0 (Bueno)',
    max: '500 (Peligroso)',
    gradient: 'linear-gradient(to right, #00e600, #ffff00, #ff9933, #ff0000, #990000, #800080)'
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
          <span>{legend.min}</span>
          <span>{legend.max}</span>
        </div>
      </div>
    </div>
  );
}
