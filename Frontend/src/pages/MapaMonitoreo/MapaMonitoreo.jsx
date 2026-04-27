/**
 * MapaMonitoreo — Mapa interactivo con marcadores y mapa de calor.
 *
 * Principios aplicados:
 * - SRP: Solo se encarga de renderizar el mapa. Los datos vienen del Context.
 * - DRY: DEPARTAMENTOS_FALLBACK se usa solo como fallback cuando no hay simulación.
 *        Los datos reales vienen de useSimulacion() (misma fuente para todos).
 * - KISS: Misma estructura que antes, solo cambiamos la fuente de datos.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import HeatmapLegend from './components/HeatmapLegend';
import Draggable from '../../components/Draggable/Draggable';
// Datos fallback cuando la simulación NO está activa (9 departamentos)
const FALLBACK_DATA = [
  { id: 'lapaz',      name: 'La Paz',      latitude: -16.4897, longitude: -68.1193, data: { temperatura: 12, aqi: 65,  ica: 78, ruido: 72, humedad: 45 } },
  { id: 'cochabamba', name: 'Cochabamba',  latitude: -17.3895, longitude: -66.1568, data: { temperatura: 24, aqi: 95,  ica: 82, ruido: 65, humedad: 30 } },
  { id: 'santacruz',  name: 'Santa Cruz',  latitude: -17.7833, longitude: -63.1812, data: { temperatura: 30, aqi: 110, ica: 55, ruido: 78, humedad: 70 } },
  { id: 'oruro',      name: 'Oruro',       latitude: -17.9624, longitude: -67.1061, data: { temperatura: 8,  aqi: 42,  ica: 88, ruido: 45, humedad: 35 } },
  { id: 'potosi',     name: 'Potosí',      latitude: -19.5836, longitude: -65.7531, data: { temperatura: 5,  aqi: 38,  ica: 91, ruido: 40, humedad: 28 } },
  { id: 'sucre',      name: 'Sucre',       latitude: -19.0353, longitude: -65.2592, data: { temperatura: 18, aqi: 55,  ica: 85, ruido: 58, humedad: 42 } },
  { id: 'tarija',     name: 'Tarija',      latitude: -21.5355, longitude: -64.7296, data: { temperatura: 22, aqi: 48,  ica: 79, ruido: 52, humedad: 55 } },
  { id: 'beni',       name: 'Trinidad',    latitude: -14.8333, longitude: -64.9000, data: { temperatura: 32, aqi: 78,  ica: 65, ruido: 62, humedad: 82 } },
  { id: 'pando',      name: 'Cobija',      latitude: -11.0267, longitude: -68.7692, data: { temperatura: 28, aqi: 72,  ica: 60, ruido: 55, humedad: 88 } },
];

function MapaMonitoreo() {
  const location = useLocation();
  const { isRunning, cities: simulatedCities } = useSimulacion();
  const { unidades, cambiarUnidad } = useUnidades();
  const [selectedCity, setSelectedCity]       = useState(null);
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);
  const [heatmapMetric, setHeatmapMetric]     = useState('aqi'); // clave en español (BD)
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [injectedCityId, setInjectedCityId]   = useState(null);
  const [activeUmbralFilter, setActiveUmbralFilter] = useState(null);

  const handleLegendRangeClick = useCallback((umbral) => {
    setActiveUmbralFilter(umbral);
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      // Asegurarse de que el layer exista antes de aplicar el filtro
      if (map.getLayer('heatmap-layer')) {
        if (umbral) {
          map.setFilter('heatmap-layer', [
            'all',
            ['>=', ['get', 'val'], umbral.valor_min],
            ['<=', ['get', 'val'], umbral.valor_max],
          ]);
        } else {
          map.setFilter('heatmap-layer', null);
        }
      }
    }
  }, []);

  // --- Estado del buscador geocoder ---
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [showResults, setShowResults]     = useState(false);

  const [isParticlesActive, setIsParticlesActive] = useState(false);
  const [weatherCode, setWeatherCode]         = useState(null);
  const [isLegendOpen, setIsLegendOpen]       = useState(true);
  const [activeLegendTab, setActiveLegendTab] = useState('unidades');
  const [localWeathers, setLocalWeathers]     = useState({});
  const [isControlsOpen, setIsControlsOpen]   = useState(false);

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

  const searchRef    = useRef(null);
  const debounceRef  = useRef(null);

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

  // --- Cerrar dropdown al hacer clic fuera ---
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Búsqueda con Mapbox Geocoding API (debounced) ---
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=6&language=es`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults(data.features || []);
        setShowResults(true);
      } catch (err) {
        console.error('Error en geocoding:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }, [MAPBOX_TOKEN]);

  const handleSelectResult = (result) => {
    const [lng, lat] = result.center;
    // Determinar zoom según tipo de lugar
    const placeType = result.place_type?.[0] || '';
    let zoom = 10;
    if (placeType === 'country') zoom = 4;
    else if (placeType === 'region') zoom = 6;
    else if (placeType === 'district' || placeType === 'locality') zoom = 8;
    else if (placeType === 'place') zoom = 10;
    else if (placeType === 'address' || placeType === 'poi') zoom = 14;

    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 });

    // Verificar si coincide con uno de los departamentos locales
    const matchedCity = citiesData.find(c =>
      c.name.toLowerCase() === result.text?.toLowerCase() ||
      result.place_name?.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matchedCity) {
      setSelectedCity(matchedCity);
    } else {
      setSelectedCity(null);
    }

    setSearchQuery(result.place_name || result.text);
    setShowResults(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

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
        temperatura: histData.temperatura,
        weatherCode: histData.weatherCode,
        aqi:     histData.aqi     != null ? histData.aqi     : '--',
        ica:     histData.ica     != null ? histData.ica     : '--',
        ruido:   histData.ruido   != null ? histData.ruido   : '--',
        humedad: histData.humedad != null ? histData.humedad : '--'
      }
    };
  }

  const MAX_METRICS = {
    temperatura: 40,
    aqi: 200,
    ica: 100,
    ruido: 100,
    humedad: 100
  };

  const heatmapData = useMemo(() => ({
    type: 'FeatureCollection',
    features: citiesData.map((city) => {
      const rawValue = city.data[heatmapMetric] || 0;
      const maxVal = MAX_METRICS[heatmapMetric];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [city.longitude, city.latitude] },
        properties: { intensityWeight: Math.min(rawValue / maxVal, 1), val: rawValue }
      };
    })
  }), [citiesData, heatmapMetric]);

  const heatmapLayer = useMemo(() => {
    let heatmapColor;
    switch (heatmapMetric) {
      case 'temperatura':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.1, '#08306b', // Frio extremo
          0.2, '#2171b5', // Frio
          0.4, '#6baed6', // Fresco
          0.5, '#74c476', // Confortable
          0.7, '#fee08b', // Calido
          0.85, '#fd8d3c', // Calor
          1.0, '#bd0026'  // Calor extremo
        ];
        break;
      case 'aqi':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#00e400',   // Bueno
          0.4, '#ffff00',   // Moderado
          0.6, '#ff7e00',   // Dañino sensibles
          0.8, '#ff0000',   // No saludable
          0.9, '#8f3f97',   // Muy no saludable
          1.0, '#7e0023'    // Peligroso
        ];
        break;
      case 'ica':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.25, '#6d4c41',  // Muy mala
          0.5, '#f57c00',   // Mala
          0.7, '#fbc02d',   // Regular
          0.9, '#1976d2',   // Buena
          1.0, '#0d47a1'    // Excelente
        ];
        break;
      case 'ruido':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.3, '#1a9850',   // Silencio
          0.55, '#91cf60',  // Tranquilo
          0.7, '#ffffbf',   // Moderado
          0.85, '#fc8d59',  // Ruidoso
          0.95, '#d73027',  // Dañino
          1.0, '#7f0000'    // Peligroso
        ];
        break;
      case 'humedad':
        heatmapColor = [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#fdae61',   // Muy seco
          0.4, '#fee090',   // Seco
          0.6, '#abd9e9',   // Confortable
          0.8, '#74add1',   // Humedo
          1.0, '#313695'    // Muy humedo
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
      data: { temperatura: null, aqi: null, ica: null, ruido: null, humedad: null },
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
          newCityData.temperatura = weather.current.temperature_2m;
          newCityData.humedad = weather.current.relative_humidity_2m;
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

  // Contar cuántos controles están activos para el badge
  const activeControlsCount = [isParticlesActive, isHeatmapActive, isHistoricalMode].filter(Boolean).length;

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
        {/* ========== Buscador Geocoder Global ========== */}
        <Draggable className="geocoder-search-container">
          <div ref={searchRef}>
            <div className="geocoder-input-wrapper">
              <span className="geocoder-icon">🔍</span>
              <input
                id="geocoder-search-input"
                type="text"
                className="geocoder-input"
                placeholder="Buscar país, ciudad o lugar…"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleClearSearch();
                    e.target.blur();
                  }
                }}
                autoComplete="off"
              />
              {searchQuery && (
                <button className="geocoder-clear-btn" onClick={handleClearSearch} aria-label="Limpiar búsqueda">
                  ×
                </button>
              )}
            </div>

            {showResults && (
              <ul className="geocoder-results-list">
                {isSearching && (
                  <li className="geocoder-result-item geocoder-loading">Buscando…</li>
                )}
                {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                  <li className="geocoder-result-item geocoder-no-results">Sin resultados</li>
                )}
                {!isSearching && searchResults.map((result) => {
                  const typeIcon = {
                    country: '🌍',
                    region: '🏔️',
                    place: '🏙️',
                    locality: '📍',
                    district: '🏘️',
                    address: '📫',
                    poi: '⭐',
                  };
                  const icon = typeIcon[result.place_type?.[0]] || '📍';
                  return (
                    <li
                      key={result.id}
                      className="geocoder-result-item"
                      onClick={() => handleSelectResult(result)}
                    >
                      <span className="geocoder-result-icon">{icon}</span>
                      <div className="geocoder-result-text">
                        <span className="geocoder-result-name">{result.text}</span>
                        {result.place_name !== result.text && (
                          <span className="geocoder-result-context">
                            {result.place_name?.replace(`${result.text}, `, '')}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Draggable>
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

        <HeatmapLegend
          metrica={heatmapMetric}
          visible={isHeatmapActive}
          onRangeClick={handleLegendRangeClick}
          onClose={() => setIsHeatmapActive(false)}
          unidad={unidades[heatmapMetric]}
        />

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
                  <span className="data-value">{formatearValor('temperatura', activeCity.data.temperatura, unidades.temperatura)}</span>
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
                  <span className="data-value">{formatearValor('ica', activeCity.data.ica, unidades.ica)}</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">🔊</div>
                <div className="data-content">
                  <span className="data-label">Nivel de Ruido</span>
                  <span className="data-value">{formatearValor('ruido', activeCity.data.ruido, unidades.ruido)}</span>
                </div>
              </div>
              <div className="data-item">
                <div className="data-icon">💦</div>
                <div className="data-content">
                  <span className="data-label">Humedad</span>
                  <span className="data-value">{formatearValor('humedad', activeCity.data.humedad, unidades.humedad)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel Unificado de Leyendas y Unidades */}
        <Draggable className={`unified-legend-panel ${!isLegendOpen ? 'collapsed' : ''}`}>
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
        </Draggable>

        {/* ═══ Toolbar Unificado de Controles (Superior Derecha) ═══ */}
        <Draggable className="map-controls-toolbar">
          <button
            className="controls-toggle-btn"
            onClick={() => setIsControlsOpen(!isControlsOpen)}
          >
            <span className={`controls-toggle-icon ${isControlsOpen ? 'open' : ''}`}>⚙️</span>
            Capas
            {activeControlsCount > 0 && (
              <span className="control-status on">{activeControlsCount}</span>
            )}
          </button>

          {isControlsOpen && (
            <div className="controls-dropdown">
              {/* Clima 3D */}
              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">🌦️</span>
                  <span className="control-text">Clima 3D</span>
                  <span className={`control-status ${isParticlesActive ? 'on' : 'off'}`}>
                    {isParticlesActive ? 'ON' : 'OFF'}
                  </span>
                </div>
                <label className="ios-switch">
                  <input
                    type="checkbox"
                    checked={isParticlesActive}
                    onChange={(e) => setIsParticlesActive(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Mapa de calor */}
              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">🗺️</span>
                  <span className="control-text">Mapa de calor</span>
                  <span className={`control-status ${isHeatmapActive ? 'on' : 'off'}`}>
                    {isHeatmapActive ? 'ON' : 'OFF'}
                  </span>
                </div>
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
              </div>

              {/* Selector de métrica — solo visible cuando el heatmap está activo */}
              {isHeatmapActive && (
                <div className="heatmap-expanded-section">
                  <div className="heatmap-metric-label">Métrica a evaluar</div>
                  <select
                    className="heatmap-metric-select"
                    value={heatmapMetric}
                    onChange={(e) => setHeatmapMetric(e.target.value)}
                  >
                    <option value="aqi">Calidad de Aire (AQI)</option>
                    <option value="ica">Calidad del Agua (ICA)</option>
                    <option value="temperatura">Temperatura</option>
                    <option value="ruido">Ruido</option>
                    <option value="humedad">Humedad</option>
                  </select>
                </div>
              )}

              {/* Histórico */}
              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">⏳</span>
                  <span className="control-text">Histórico</span>
                  <span className={`control-status ${isHistoricalMode ? 'on' : 'off'}`}>
                    {isHistoricalMode ? 'ON' : 'OFF'}
                  </span>
                </div>
                <label className="ios-switch">
                  <input
                    type="checkbox"
                    checked={isHistoricalMode}
                    onChange={(e) => setIsHistoricalMode(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          )}
        </Draggable>
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
