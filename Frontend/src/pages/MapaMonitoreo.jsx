import { useState, useMemo } from 'react';
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl } from 'react-map-gl/mapbox';
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
          
          {pins}
        </Map>

        {/* Panel Flotante de Información de la Ciudad */}
        {selectedCity && (
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
      </div>
    </div>
  );
}

export default MapaMonitoreo;
