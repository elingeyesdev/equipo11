import React from 'react';
import WeatherWidget from './WeatherWidget';
import AiWeatherAnalysis from './AiWeatherAnalysis';
import { useForecastData } from '../../hooks/useForecastData';
import { useTheme } from '../../context/ThemeContext';

export default function WeatherWidgetContainer({ city, onClose }) {
  const { data, loading, error } = useForecastData(city?.lat, city?.lon);
  const { theme } = useTheme();

  if (!city) return null;

  return (
    <div className="weather-widget-container" style={{
      position: 'absolute',
      right: '20px',
      top: '80px',
      width: '380px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {onClose && (
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', right: '-10px', top: '-10px',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '50%', width: '30px', height: '30px',
            cursor: 'pointer', zIndex: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-primary)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}
        >
          ✕
        </button>
      )}
      
      {loading && (
        <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
          Cargando pronóstico...
        </div>
      )}
      
      {error && (
        <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '16px', color: 'red' }}>
          Error: {error}
        </div>
      )}

      {data && (
        <>
          <WeatherWidget 
            forecastData={data} 
            cityName={city.nombre || 'Ciudad Seleccionada'} 
            isDarkTheme={theme === 'dark'} 
          />
          <AiWeatherAnalysis 
            ciudad={city.nombre || 'Ciudad Seleccionada'} 
            lat={city.lat} 
            lon={city.lon} 
          />
        </>
      )}
    </div>
  );
}
