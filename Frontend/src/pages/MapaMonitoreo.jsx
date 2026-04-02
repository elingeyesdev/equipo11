import { useState, useMemo } from 'react';
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMonitoreo.css';

// Datos estáticos simulados para MVP con ciudades de Bolivia
const CITIES_DATA = [
  {
    id: 'lapaz',
    name: 'La Paz',
    latitude: -16.4897,
    longitude: -68.1193,
    data: {
      temperature: 12,
      aqi: 65, // Calidad del aire
      noise: 72, // Ruido en decibeles
      humidity: 45
    }
  },
  {
    id: 'cochabamba',
    name: 'Cochabamba',
    latitude: -17.3895,
    longitude: -66.1568,
    data: {
      temperature: 24,
      aqi: 95,
      noise: 65,
      humidity: 30
    }
  },
  {
    id: 'santacruz',
    name: 'Santa Cruz',
    latitude: -17.7833,
    longitude: -63.1812,
    data: {
      temperature: 30,
      aqi: 110,
      noise: 78,
      humidity: 70
    }
  }
];

function MapaMonitoreo() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);
  const [heatmapMetric, setHeatmapMetric] = useState('aqi');

  // Valores máximos para normalizar el heatmap de 0 a 1
  const MAX_METRICS = {
    temperature: 40,
    aqi: 200,
    noise: 100,
    humidity: 100
  };

  // Generamos el GeoJSON en tiempo real cuando la métrica o los datos cambian
  const heatmapData = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: CITIES_DATA.map((city) => {
        let rawValue = city.data[heatmapMetric] || 0;
        let maxVal = MAX_METRICS[heatmapMetric];
        
        // Calculamos intensidad de 0 a 1
        let intensityWeight = Math.min(rawValue / maxVal, 1);
        
        // Si la métrica es humedad, podríamos invertir el color o dejarlo normal. Dejamos que más alto = más "caliente" (rojo).
        return {
          type: 'Feature',
          geometry: { 
            type: 'Point', 
            coordinates: [city.longitude, city.latitude] 
          },
          properties: {
            intensityWeight: intensityWeight
          }
        };
      })
    };
  }, [heatmapMetric]);

  const heatmapLayer = useMemo(() => ({
    id: 'heatmap-layer',
    type: 'heatmap',
    paint: {
      'heatmap-weight': [
        'interpolate', ['linear'], ['get', 'intensityWeight'],
        0, 0,
        1, 1
      ],
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        0, 1,
        9, 3
      ],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ],
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, 30,
        9, 70
      ],
      'heatmap-opacity': 0.8
    }
  }), []);

  // Configuramos el mapa para mostrar a Bolivia de forma centrada por defecto
  const [viewState, setViewState] = useState({
    longitude: -64.6853,
    latitude: -16.2902,
    zoom: 5
  });

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  // Renderizar los marcadores de manera memorizada
  const pins = useMemo(
    () =>
      CITIES_DATA.map((city, index) => (
        <Marker
          key={`marker-${index}`}
          longitude={city.longitude}
          latitude={city.latitude}
          anchor="bottom"
          onClick={e => {
            // Prevenir que el click se propague al mapa y lo deseleccione
            e.originalEvent.stopPropagation();
            setSelectedCity(city);
          }}
        >
          <div className="custom-marker">
            <span role="img" aria-label="pin">📍</span>
          </div>
        </Marker>
      )),
    []
  );

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return '#00e400'; // Good
    if (aqi <= 100) return '#ffff00'; // Moderate
    if (aqi <= 150) return '#ff7e00'; // Unhealthy for sensitive
    return '#ff0000'; // Unhealthy
  };

  return (
    <div className="mapa-page-container">
      {!MAPBOX_TOKEN && (
        <div className="missing-token-banner">
          ⚠️ VITE_MAPBOX_TOKEN no está definido en el archivo .env
        </div>
      )}

      {/* Contenedor principal del Mapa */}
      <div className="map-container">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={() => setSelectedCity(null)} // Click afuera limpia la selección
        >
          {/* Controles de navegación y geolocalización (útil para móviles) */}
          <GeolocateControl position="bottom-right" />
          <FullscreenControl position="bottom-right" />
          <NavigationControl position="bottom-right" />
          
          {/* Capa de Mapa de Calor */}
          {isHeatmapActive && (
            <Source id="heatmap-data" type="geojson" data={heatmapData}>
              <Layer {...heatmapLayer} />
            </Source>
          )}

          {/* Marcadores Estáticos - Se ocultan en modo heatmap */}
          {!isHeatmapActive && pins}
        </Map>

        {/* Panel Flotante de Información de la Ciudad */}
        {(!isHeatmapActive && selectedCity) && (
          <div className="city-info-panel">
            <button 
              className="close-panel-btn"
              onClick={() => setSelectedCity(null)}
              aria-label="Cerrar panel"
            >
              ×
            </button>
            <div className="panel-header">
              <h3>{selectedCity.name}</h3>
              <p className="panel-subtitle">Datos en tiempo real (simulados)</p>
            </div>
            
            <div className="panel-body">
              <div className="data-item">
                <div className="data-icon">🌡️</div>
                <div className="data-content">
                  <span className="data-label">Temperatura</span>
                  <span className="data-value">{selectedCity.data.temperature}°C</span>
                </div>
              </div>
              
              <div className="data-item">
                <div className="data-icon">🌫️</div>
                <div className="data-content">
                  <span className="data-label">Calidad del Aire (AQI)</span>
                  <span className="data-value" style={{ color: getAqiColor(selectedCity.data.aqi), fontWeight: 'bold' }}>
                    {selectedCity.data.aqi}
                  </span>
                </div>
              </div>
              
              <div className="data-item">
                <div className="data-icon">🔊</div>
                <div className="data-content">
                  <span className="data-label">Nivel de Ruido</span>
                  <span className="data-value">{selectedCity.data.noise} dB</span>
                </div>
              </div>

              <div className="data-item">
                <div className="data-icon">💧</div>
                <div className="data-content">
                  <span className="data-label">Humedad</span>
                  <span className="data-value">{selectedCity.data.humidity}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel de Control Flotante del Mapa de Calor (Heatmap) */}
        <div className="heatmap-control-panel">
          <div className="heatmap-toggle-wrapper">
            <label className="ios-switch">
              <input 
                type="checkbox" 
                checked={isHeatmapActive}
                onChange={(e) => {
                  setIsHeatmapActive(e.target.checked);
                  if (e.target.checked) setSelectedCity(null); // Ocultar ciudad al activar
                }}
              />
              <span className="slider round"></span>
            </label>
            <span className="heatmap-label">{isHeatmapActive ? 'Heatmap: ON' : 'Heatmap: OFF'}</span>
          </div>

          {isHeatmapActive && (
            <div className="heatmap-metric-selector">
              <label>Métrica a evaluar:</label>
              <select 
                value={heatmapMetric} 
                onChange={(e) => setHeatmapMetric(e.target.value)}
              >
                <option value="aqi">Calidad de Aire (AQI)</option>
                <option value="temperature">Temperatura</option>
                <option value="noise">Ruido</option>
                <option value="humidity">Humedad</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapaMonitoreo;
