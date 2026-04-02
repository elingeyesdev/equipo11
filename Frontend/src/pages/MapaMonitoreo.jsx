/**
 * MapaMonitoreo — Mapa interactivo con marcadores y mapa de calor.
 *
 * Principios aplicados:
 * - SRP: Solo se encarga de renderizar el mapa. Los datos vienen del Context.
 * - DRY: DEPARTAMENTOS_FALLBACK se usa solo como fallback cuando no hay simulación.
 *        Los datos reales vienen de useSimulacion() (misma fuente para todos).
 * - KISS: Misma estructura que antes, solo cambiamos la fuente de datos.
 */
import { useState, useMemo } from 'react';
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMonitoreo.css';
import { useSimulacion } from '../context/SimulacionContext';

// Datos fallback cuando la simulación NO está activa (9 departamentos)
const FALLBACK_DATA = [
  { id: 'lapaz',      name: 'La Paz',      latitude: -16.4897, longitude: -68.1193, data: { temperature: 12, aqi: 65,  waterQuality: 78, noise: 72, humidity: 45 } },
  { id: 'cochabamba', name: 'Cochabamba',  latitude: -17.3895, longitude: -66.1568, data: { temperature: 24, aqi: 95,  waterQuality: 82, noise: 65, humidity: 30 } },
  { id: 'santacruz',  name: 'Santa Cruz',  latitude: -17.7833, longitude: -63.1812, data: { temperature: 30, aqi: 110, waterQuality: 55, noise: 78, humidity: 70 } },
  { id: 'oruro',      name: 'Oruro',       latitude: -17.9624, longitude: -67.1061, data: { temperature: 8,  aqi: 42,  waterQuality: 88, noise: 45, humidity: 35 } },
  { id: 'potosi',     name: 'Potosí',      latitude: -19.5836, longitude: -65.7531, data: { temperature: 5,  aqi: 38,  waterQuality: 91, noise: 40, humidity: 28 } },
  { id: 'sucre',      name: 'Sucre',       latitude: -19.0353, longitude: -65.2592, data: { temperature: 18, aqi: 55,  waterQuality: 85, noise: 58, humidity: 42 } },
  { id: 'tarija',     name: 'Tarija',      latitude: -21.5355, longitude: -64.7296, data: { temperature: 22, aqi: 48,  waterQuality: 79, noise: 52, humidity: 55 } },
  { id: 'beni',       name: 'Trinidad',    latitude: -14.8333, longitude: -64.9000, data: { temperature: 32, aqi: 78,  waterQuality: 65, noise: 62, humidity: 82 } },
  { id: 'pando',      name: 'Cobija',      latitude: -11.0267, longitude: -68.7692, data: { temperature: 28, aqi: 72,  waterQuality: 60, noise: 55, humidity: 88 } },
];

function MapaMonitoreo() {
  const { isRunning, cities: simulatedCities } = useSimulacion();
  const [selectedCity, setSelectedCity]       = useState(null);
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);
  const [heatmapMetric, setHeatmapMetric]     = useState('aqi');

  // Usar datos simulados si la simulación está activa, sino fallback
  const citiesData = (isRunning && simulatedCities.length > 0) ? simulatedCities : FALLBACK_DATA;

  // Si la ciudad seleccionada se actualizó por la simulación, sincronizar sus datos
  const activeCity = selectedCity
    ? citiesData.find(c => c.id === selectedCity.id) || selectedCity
    : null;

  const MAX_METRICS = {
    temperature: 40,
    aqi: 200,
    waterQuality: 100,
    noise: 100,
    humidity: 100
  };

  // GeoJSON para heatmap — se recalcula cuando cambian datos o métrica
  const heatmapData = useMemo(() => ({
    type: 'FeatureCollection',
    features: citiesData.map((city) => {
      const rawValue = city.data[heatmapMetric] || 0;
      const maxVal = MAX_METRICS[heatmapMetric];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [city.longitude, city.latitude] },
        properties: { intensityWeight: Math.min(rawValue / maxVal, 1) }
      };
    })
  }), [citiesData, heatmapMetric]);

  const heatmapLayer = useMemo(() => ({
    id: 'heatmap-layer',
    type: 'heatmap',
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensityWeight'], 0, 0, 1, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 30, 9, 70],
      'heatmap-opacity': 0.8
    }
  }), []);

  const [viewState, setViewState] = useState({
    longitude: -64.6853,
    latitude: -16.2902,
    zoom: 5
  });

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return '#00e400';
    if (aqi <= 100) return '#ffff00';
    if (aqi <= 150) return '#ff7e00';
    return '#ff0000';
  };

  return (
    <div className="mapa-page-container">
      {!MAPBOX_TOKEN && (
        <div className="missing-token-banner">
          ⚠️ VITE_MAPBOX_TOKEN no está definido en el archivo .env
        </div>
      )}

      {/* Indicador de simulación activa */}
      {isRunning && (
        <div className="sim-active-banner">
          <span className="sim-active-dot"></span>
          Simulación en tiempo real activa — los datos se actualizan automáticamente
        </div>
      )}

      <div className="map-container">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={() => setSelectedCity(null)}
        >
          <GeolocateControl position="bottom-right" />
          <FullscreenControl position="bottom-right" />
          <NavigationControl position="bottom-right" />
          
          {/* Capa de Mapa de Calor */}
          {isHeatmapActive && (
            <Source id="heatmap-data" type="geojson" data={heatmapData}>
              <Layer {...heatmapLayer} />
            </Source>
          )}

          {/* Marcadores — se muestran siempre fuera del modo heatmap */}
          {!isHeatmapActive && citiesData.map((city) => (
            <Marker
              key={city.id}
              longitude={city.longitude}
              latitude={city.latitude}
              anchor="bottom"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setSelectedCity(city);
              }}
            >
              <div className="custom-marker">
                <span role="img" aria-label="pin">📍</span>
              </div>
            </Marker>
          ))}
        </Map>

        {/* Panel Flotante de Información */}
        {(!isHeatmapActive && activeCity) && (
          <div className="city-info-panel">
            <button className="close-panel-btn" onClick={() => setSelectedCity(null)} aria-label="Cerrar panel">×</button>
            <div className="panel-header">
              <h3>{activeCity.name}</h3>
              <p className="panel-subtitle">
                {isRunning ? 'Datos en tiempo real (simulados)' : 'Datos estáticos'}
              </p>
            </div>
            <div className="panel-body">
              <div className="data-item">
                <div className="data-icon">🌡️</div>
                <div className="data-content">
                  <span className="data-label">Temperatura</span>
                  <span className="data-value">{activeCity.data.temperature}°C</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">🌫️</div>
                <div className="data-content">
                  <span className="data-label">Calidad del Aire (AQI)</span>
                  <span className="data-value" style={{ color: getAqiColor(activeCity.data.aqi), fontWeight: 'bold' }}>
                    {activeCity.data.aqi}
                  </span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">💧</div>
                <div className="data-content">
                  <span className="data-label">Calidad del Agua (ICA)</span>
                  <span className="data-value">{activeCity.data.waterQuality}</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">🔊</div>
                <div className="data-content">
                  <span className="data-label">Nivel de Ruido</span>
                  <span className="data-value">{activeCity.data.noise} dB</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">💦</div>
                <div className="data-content">
                  <span className="data-label">Humedad</span>
                  <span className="data-value">{activeCity.data.humidity}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel de Control del Heatmap */}
        <div className="heatmap-control-panel">
          <div className="heatmap-toggle-wrapper">
            <label className="ios-switch">
              <input
                type="checkbox"
                checked={isHeatmapActive}
                onChange={(e) => {
                  setIsHeatmapActive(e.target.checked);
                  if (e.target.checked) setSelectedCity(null);
                }}
              />
              <span className="slider round"></span>
            </label>
            <span className="heatmap-label">{isHeatmapActive ? 'Heatmap: ON' : 'Heatmap: OFF'}</span>
          </div>

          {isHeatmapActive && (
            <div className="heatmap-metric-selector">
              <label>Métrica a evaluar:</label>
              <select value={heatmapMetric} onChange={(e) => setHeatmapMetric(e.target.value)}>
                <option value="aqi">Calidad de Aire (AQI)</option>
                <option value="waterQuality">Calidad del Agua (ICA)</option>
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
