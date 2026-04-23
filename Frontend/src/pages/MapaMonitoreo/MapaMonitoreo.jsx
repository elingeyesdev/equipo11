/**
 * MapaMonitoreo — Mapa interactivo con marcadores y mapa de calor.
 *
 * Principios aplicados:
 * - SRP: Solo se encarga de renderizar el mapa. Los datos vienen del Context.
 * - DRY: DEPARTAMENTOS_FALLBACK se usa solo como fallback cuando no hay simulación.
 *        Los datos reales vienen de useSimulacion() (misma fuente para todos).
 * - KISS: Misma estructura que antes, solo cambiamos la fuente de datos.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMonitoreo.css';
import { useSimulacion } from '../../context/SimulacionContext';
import ModalSimulacion from '../../components/ModalSimulacion/ModalSimulacion';
import WeatherParticles from '../../components/WeatherParticles/WeatherParticles';
import Timeline from '../../components/Timeline/Timeline';
import { getWeatherAtLocation, getAqiAtLocation, getPlaceName, getBulkWeatherForLocations, getHistoricalWeatherAtLocation } from '../../utils/weatherApi';
import { useUnidades } from '../../hooks/useUnidades';
import { formatearValor, METRICAS_UNIDADES } from '../../utils/unidades';

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
  const location = useLocation();
  const { isRunning, cities: simulatedCities } = useSimulacion();
  const { unidades, cambiarUnidad } = useUnidades();
  const [selectedCity, setSelectedCity]       = useState(null);
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);
  const [heatmapMetric, setHeatmapMetric]     = useState('aqi');
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [injectedCityId, setInjectedCityId]   = useState(null);
  const [isParticlesActive, setIsParticlesActive] = useState(false);
  const [weatherCode, setWeatherCode]         = useState(null);
  const [isLegendOpen, setIsLegendOpen]       = useState(true);
  const [activeLegendTab, setActiveLegendTab] = useState('unidades');
  const [localWeathers, setLocalWeathers]     = useState({});

  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [cityHistoryArray, setCityHistoryArray] = useState([]);
  const [timelineIndex, setTimelineIndex] = useState(0);

  // Fetch historical data dinámicamente según click
  useEffect(() => {
    if (isHistoricalMode && selectedCity) {
      const fetchHistory = async () => {
        // Intentar API de Open-Meteo primero
        const apiData = await getHistoricalWeatherAtLocation(selectedCity.latitude, selectedCity.longitude);
        
        if (apiData && apiData.length > 0) {
          setCityHistoryArray(apiData);
          const now = Date.now();
          let closestIdx = apiData.length - 1;
          let minDiff = Infinity;
          apiData.forEach(e => {
            const diff = Math.abs(new Date(e.timestamp).getTime() - now);
            if (diff < minDiff) { minDiff = diff; closestIdx = e.index; }
          });
          setTimelineIndex(closestIdx);
        } else {
          // Fallback a Base de Datos Local
          try {
            const res = await fetch('http://localhost:3000/api/historial');
            const data = await res.json();
            const fallbackMapped = data.map((snapshot, idx) => {
              const cData = snapshot.cities.find(c => c.id === selectedCity.id);
              return {
                index: idx,
                timestamp: snapshot.timestamp,
                data: cData ? cData.data : null
              };
            }).filter(e => e.data !== null);

            setCityHistoryArray(fallbackMapped);
            setTimelineIndex(fallbackMapped.length > 0 ? fallbackMapped.length - 1 : 0);
          } catch(err) {
            console.error("Historical Fallback failed", err);
          }
        }
      };
      fetchHistory();
    }
  }, [isHistoricalMode, selectedCity?.latitude, selectedCity?.longitude]);

  // Carga paralela masiva de climas locales para todas las ciudades si se activa la vista 3D
  useEffect(() => {
    if (!isParticlesActive) return;
    
    let mounted = true;
    const fetchLocalWeathers = async () => {
      try {
        const results = await getBulkWeatherForLocations(citiesData);
        if (mounted) {
          setLocalWeathers(prev => ({...prev, ...results}));
        }
      } catch (e) { console.error("Error bulk weather", e); }
    };

    fetchLocalWeathers();
    return () => { mounted = false; };
  }, [isParticlesActive]);

  const mapRef      = useRef(null);
  const pendingFlyTo = useRef(null); // flyTo pendiente si el mapa aún no cargó

  // Abrir modal o centrar en ciudad inyectada según el estado de navegación
  useEffect(() => {
    if (location.state?.openModal) {
      setIsModalOpen(true)
      window.history.replaceState({}, '')
      return
    }

    if (location.state?.abrirPanel && location.state?.ciudad) {
      const cityId = location.state.ciudad
      // Usar FALLBACK_DATA para coordenadas (siempre disponible, independiente de la simulación)
      const city = FALLBACK_DATA.find(c => c.id === cityId)
      if (city) {
        setSelectedCity(city)
        setInjectedCityId(cityId)
        setTimeout(() => setInjectedCityId(null), 4000)

        const flyToParams = { center: [city.longitude, city.latitude], zoom: 8, duration: 1200 }
        if (mapRef.current) {
          mapRef.current.flyTo(flyToParams)
        } else {
          pendingFlyTo.current = flyToParams
        }
      }
      window.history.replaceState({}, '')
    }
  }, [location.state]);

  // Usar datos del contexto si existen (simulación activa o datos inyectados), sino fallback estático
  let citiesData = simulatedCities.length > 0 ? simulatedCities : FALLBACK_DATA;

  // Si la ciudad seleccionada se actualizó por la simulación, sincronizar sus datos básicos
  let activeCity = selectedCity
    ? citiesData.find(c => c.id === selectedCity.id) || selectedCity
    : null;
    
  // Override para Modo Histórico enfocado en la ciudad seleccionada
  if (isHistoricalMode && activeCity && cityHistoryArray.length > 0 && cityHistoryArray[timelineIndex]) {
    // Sobrescribimos temporalmente solo los datos internos que muestra el panel flotante
    const histData = cityHistoryArray[timelineIndex].data;
    activeCity = {
      ...activeCity,
      data: {
        ...activeCity.data, 
        temperature: histData.temperature,
        weatherCode: histData.weatherCode,
        // Limpiamos los que sabemos que OpenAPI no tiene; si hay db fallback los conservaría.
        aqi: histData.aqi !== null ? histData.aqi : '--',
        waterQuality: histData.waterQuality !== null ? histData.waterQuality : '--',
        noise: histData.noise !== null ? histData.noise : '--',
        humidity: histData.humidity !== null ? histData.humidity : '--'
      }
    };
  }

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

  const heatmapLayer = useMemo(() => {
    let heatmapColor;
    switch (heatmapMetric) {
      case 'temperature':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#0000ff', // azul
          0.6, '#ffffff', // blanco
          1.0, '#ff0000'  // rojo
        ];
        break;
      case 'aqi':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#00e400',   // Bueno
          0.4, '#ffff00',   // Moderado
          0.6, '#ff7e00',   // No saludable sensibles
          0.8, '#ff0000',   // No saludable
          1.0, '#7e0023'    // Peligroso
        ];
        break;
      case 'waterQuality':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#00008b',   // azul oscuro
          0.5, '#00bfff',   // celeste
          0.8, '#ffff00',   // amarillo
          1.0, '#8b4513'    // marrón
        ];
        break;
      case 'noise':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#00e400',   // verde
          0.5, '#ffff00',   // amarillo
          0.8, '#ff7e00',   // naranja
          1.0, '#ff0000'    // rojo
        ];
        break;
      case 'humidity':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#f5f5dc',   // beige seco
          0.5, '#00bfff',   // celeste
          1.0, '#00008b'    // azul oscuro
        ];
        break;
      default:
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)'
        ];
    }

    return {
      id: 'heatmap-layer',
      type: 'heatmap',
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensityWeight'], 0, 0, 1, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
        'heatmap-color': heatmapColor,
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 30, 9, 70],
        'heatmap-opacity': 0.8
      }
    };
  }, [heatmapMetric]);

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

  // Disparo inicial de clima al encender el Switch
  useEffect(() => {
    if (isParticlesActive) {
      getWeatherAtLocation(viewState.latitude, viewState.longitude).then(w => {
         if (w && w.current) setWeatherCode(w.current.weather_code);
      }).catch(() => {});
    }
  }, [isParticlesActive]);

  // Actualización automática del clima basado en el centro del mapa 
  // ¡Se ejecuta cuando el usuario suelta el mouse después de arrastrar!
  const handleMapMoveEnd = async (evt) => {
    if (!isParticlesActive) return;
    const { longitude, latitude } = evt.viewState;
    try {
      const weather = await getWeatherAtLocation(latitude, longitude);
      if (weather && weather.current) {
        setWeatherCode(weather.current.weather_code);
      }
    } catch(err) {
      console.error("Error auto-fetching weather map center", err);
    }
  };

  const handleMapClick = async (evt) => {
    if (isHeatmapActive) {
        setSelectedCity(null);
        return;
    }

    const { lng, lat } = evt.lngLat;
    
    const clickCity = {
      id: `click_${Date.now()}`,
      name: `Buscando zona...`,
      subtitle: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
      latitude: lat,
      longitude: lng,
      data: { temperature: null, aqi: null, waterQuality: null, noise: null, humidity: null },
      isLoading: true
    };
    setSelectedCity(clickCity);
    setWeatherCode(null); // Reseteamos clima mientras carga

    try {
      const [weather, aqiData, placeName] = await Promise.all([
        getWeatherAtLocation(lat, lng),
        getAqiAtLocation(lat, lng),
        getPlaceName(lat, lng, MAPBOX_TOKEN)
      ]);

      let wCode = null;
      let newCityData = { ...clickCity.data };
      
      if (weather && weather.current) {
          newCityData.temperature = weather.current.temperature_2m;
          newCityData.humidity = weather.current.relative_humidity_2m;
          newCityData.wind = weather.current.wind_speed_10m;
          wCode = weather.current.weather_code;
      }
      if (aqiData && aqiData.current) {
          newCityData.aqi = aqiData.current.european_aqi;
      }

      setWeatherCode(wCode);

      setSelectedCity({
        ...clickCity,
        name: placeName ? placeName : 'Ubicación Desconocida',
        subtitle: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
        data: newCityData,
        isLoading: false
      });
    } catch (e) {
      console.error("Error al obtener datos:", e);
      setSelectedCity({ ...clickCity, name: 'Error en conexión' });
    }
  };

  return (
    <div className="mapa-page-container">
      <ModalSimulacion isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
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
          <button
            className="sim-active-modal-btn"
            onClick={() => setIsModalOpen(true)}
          >
            Ver estado
          </button>
        </div>
      )}

      <div className="map-container">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onMoveEnd={handleMapMoveEnd}
          onLoad={() => {
            if (pendingFlyTo.current) {
              mapRef.current.flyTo(pendingFlyTo.current)
              pendingFlyTo.current = null
            }
          }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={handleMapClick}
        >
          <GeolocateControl position="bottom-right" />
          <FullscreenControl position="bottom-right" />
          <NavigationControl position="bottom-right" />
          
          {/* Capa de Mapa de Calor de Calidad del Aire */}
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
              onClick={async (e) => {
                e.originalEvent.stopPropagation();
                setSelectedCity(city);
                try {
                  const weather = await getWeatherAtLocation(city.latitude, city.longitude);
                  let finalCode = weather.current.weather_code;
                  
                  setWeatherCode(finalCode);
                } catch(err) {
                  console.error("Error obteniendo clima para el marcador", err);
                }
              }}
            >
              <div className={`custom-marker${injectedCityId === city.id ? ' custom-marker--injected' : ''}`}>
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
                {activeCity.subtitle 
                  ? activeCity.subtitle 
                  : (isRunning ? 'Datos en tiempo real (simulados)' : 'Datos estáticos')}
              </p>
            </div>
            <div className="panel-body">
              <div className="data-item">
                <div className="data-icon">🌡️</div>
                <div className="data-content">
                  <span className="data-label">Temperatura</span>
                  <span className="data-value">{formatearValor('temperature', activeCity.data.temperature, unidades.temperature)}</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">🌫️</div>
                <div className="data-content">
                  <span className="data-label">Calidad del Aire</span>
                  <span className="data-value" style={{ color: getAqiColor(activeCity.data.aqi), fontWeight: 'bold' }}>
                    {formatearValor('aqi', activeCity.data.aqi, unidades.aqi)}
                  </span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">💧</div>
                <div className="data-content">
                  <span className="data-label">Calidad del Agua</span>
                  <span className="data-value">{formatearValor('waterQuality', activeCity.data.waterQuality, unidades.waterQuality)}</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">🔊</div>
                <div className="data-content">
                  <span className="data-label">Nivel de Ruido</span>
                  <span className="data-value">{formatearValor('noise', activeCity.data.noise, unidades.noise)}</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">💦</div>
                <div className="data-content">
                  <span className="data-label">Humedad</span>
                  <span className="data-value">{formatearValor('humidity', activeCity.data.humidity, unidades.humidity)}</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">🌬️</div>
                <div className="data-content">
                  <span className="data-label">Viento</span>
                  <span className="data-value">{activeCity.data.wind !== undefined && activeCity.data.wind !== null && activeCity.data.wind !== '--' ? `${activeCity.data.wind} km/h` : '--'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel Unificado de Leyendas y Unidades */}
        <div className={`unified-legend-panel ${!isLegendOpen ? 'collapsed' : ''}`}>
          <div className="unified-legend-header">
            <div className="unified-legend-tabs">
              <button 
                className={`legend-tab ${activeLegendTab === 'unidades' ? 'active' : ''}`}
                onClick={() => setActiveLegendTab('unidades')}
              >
                Unidades
              </button>
              <button 
                className={`legend-tab ${activeLegendTab === 'clima' ? 'active' : ''}`}
                onClick={() => setActiveLegendTab('clima')}
              >
                Clima 3D
              </button>
            </div>
            <button 
              className="legend-toggle-btn" 
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              title={isLegendOpen ? "Ocultar panel" : "Mostrar panel"}
            >
              {isLegendOpen ? '▼' : '▲'}
            </button>
          </div>
          
          {isLegendOpen && (
            <div className="unified-legend-body">
              {activeLegendTab === 'unidades' && (
                <div className="units-content">
                  {Object.entries(METRICAS_UNIDADES).map(([key, cfg]) => (
                    <div key={key} className="units-row">
                      <span className="units-row-icon">{cfg.icon}</span>
                      {cfg.unidades.length > 1 ? (
                        <select
                          className="units-select"
                          value={unidades[key]}
                          onChange={e => cambiarUnidad(key, e.target.value)}
                        >
                          {cfg.unidades.map(u => (
                            <option key={u.key} value={u.key}>{u.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="units-fixed-label">{cfg.unidades[0].label}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {activeLegendTab === 'clima' && (
                <div className="clima-legend-content">
                  <div className="clima-legend-item">
                    <span className="clima-dot" style={{ background: '#0984e3', border: '1px solid #74b9ff' }}></span> Lluvia
                  </div>
                  <div className="clima-legend-item">
                    <span className="clima-dot" style={{ background: '#ffffff', border: '1px solid #74b9ff' }}></span> Nieve
                  </div>
                  <div className="clima-legend-item">
                    <span className="clima-dot" style={{ background: '#b2bec3', border: '1px solid #636e72' }}></span> Niebla
                  </div>
                  <div className="clima-legend-item">
                    <span className="clima-dot" style={{ background: '#ffeaa7', border: '1px solid #e17055' }}></span> Despejado
                  </div>
                  <p className="clima-legend-hint">Actualización automática al arrastrar el mapa.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel de Control de Partículas */}
        <div className="particles-control-panel">
          <div className="heatmap-toggle-wrapper">
            <label className="ios-switch">
              <input
                type="checkbox"
                checked={isParticlesActive}
                onChange={(e) => setIsParticlesActive(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
            <span className="heatmap-label">{isParticlesActive ? 'Clima 3D: ON' : 'Clima 3D: OFF'}</span>
          </div>
        </div>

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
            <span className="heatmap-label">{isHeatmapActive ? 'Mapa de calor: ON' : 'Mapa de calor: OFF'}</span>
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

          <div className="heatmap-toggle-wrapper" style={{ marginTop: '15px' }}>
            <label className="ios-switch">
              <input
                type="checkbox"
                checked={isHistoricalMode}
                onChange={(e) => {
                  setIsHistoricalMode(e.target.checked);
                }}
              />
              <span className="slider round"></span>
            </label>
            <span className="heatmap-label">{isHistoricalMode ? 'Histórico: ON' : 'Histórico: OFF'}</span>
          </div>
         </div>
      </div>
      
      <WeatherParticles 
        isEnabled={isParticlesActive} 
        weatherCode={weatherCode} 
        currentZoom={viewState.zoom}
      />

      {isHistoricalMode && !activeCity && (
        <div className="historical-prompt">
          <span style={{ fontSize: '1.2rem', marginBottom: '5px' }}>⏳ Modo Histórico Activado</span>
          <span style={{ opacity: 0.8 }}>Selecciona una ciudad o clickea el mapa para cargar su historia.</span>
        </div>
      )}

      {isHistoricalMode && activeCity && (
        <Timeline 
          cityHistoryArray={cityHistoryArray}
          currentIndex={timelineIndex}
          onIndexChange={(idx) => setTimelineIndex(idx)}
        />
      )}
    </div>
  );
}

export default MapaMonitoreo;
