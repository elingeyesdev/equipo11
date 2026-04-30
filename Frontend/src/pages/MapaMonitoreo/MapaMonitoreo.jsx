/**
 * MapaMonitoreo — Mapa interactivo con marcadores y mapa de calor.
 *
 * Fuentes de datos (en orden de prioridad):
 *  1. simulatedCities — socket "simulacion:datos" cuando la simulación está ON
 *  2. ultimoEstado    — GET /api/historial/ultimo-estado cuando la simulación está OFF
 *  3. localidades     — GET /api/geografia/localidades (base geográfica, sin métricas)
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMonitoreo.css';
import { useSimulacion } from '../../context/SimulacionContext';
import ModalSimulacion from '../../components/ModalSimulacion/ModalSimulacion';
import Timeline from '../../components/Timeline/Timeline';
import { getWeatherAtLocation, getAqiAtLocation, getPlaceName, getHistoricalWeatherAtLocation } from '../../utils/weatherApi';
import axios from 'axios';
import GridRadarLayer from '../../components/GridRadarLayer/GridRadarLayer';
import { useUnidades } from '../../hooks/useUnidades';
import { formatearValor, METRICAS_UNIDADES } from '../../utils/unidades';
import HeatmapLegend from './components/HeatmapLegend';
import Draggable from '../../components/Draggable/Draggable';
import VoronoiLayer from './layers/VoronoiLayer';
import MarkersLayer from './layers/MarkersLayer';
import { useUmbrales, colorPorValor } from '../../hooks/useUmbrales';
const API_BASE = 'http://localhost:3000';

function MapaMonitoreo() {
  const location = useLocation();
  const { isRunning, cities: simulatedCities } = useSimulacion();
  const { unidades, cambiarUnidad } = useUnidades();

  // Base geográfica: localidades desde la BD (sin métricas ambientales)
  const [localidades, setLocalidades] = useState([]);
  // Último snapshot de métricas guardado en BD (cuando la simulación está OFF)
  const [ultimoEstado, setUltimoEstado] = useState([]);

  // Carga inicial: localidades geográficas
  useEffect(() => {
    fetch(`${API_BASE}/api/geografia/localidades`)
      .then(r => r.json())
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map(loc => ({
          id: String(loc.localidad_id ?? loc.id),
          name: loc.nombre ?? loc.name,
          latitude: parseFloat(loc.latitud ?? loc.latitude),
          longitude: parseFloat(loc.longitud ?? loc.longitude),
          data: { temperatura: null, aqi: null, ica: null, ruido: null, humedad: null },
          fuente_id: null,
        }));
        setLocalidades(mapped);
      })
      .catch(err => console.error('[Localidades]', err));
  }, []);

  // Cuando la simulación se apaga, cargar el último estado conocido de la BD
  useEffect(() => {
    if (isRunning) {
      setUltimoEstado([]);
      return;
    }
    fetch(`${API_BASE}/api/historial/ultimo-estado`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setUltimoEstado(data);
      })
      .catch(err => console.error('[UltimoEstado]', err));
  }, [isRunning]);

  const [selectedCity, setSelectedCity] = useState(null);
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);
  const [heatmapMetric, setHeatmapMetric] = useState('aqi'); // clave en español (BD)
  // Umbrales dinámicos de la métrica activa — fuente única de verdad para colores
  const { umbrales } = useUmbrales(heatmapMetric);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [injectedCityId, setInjectedCityId] = useState(null);
  const [activeUmbralFilter, setActiveUmbralFilter] = useState(null);

  const handleLegendRangeClick = useCallback((umbral) => {
    setActiveUmbralFilter(umbral);
  }, []);

  // --- Estado del buscador geocoder ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [isParticlesActive, setIsParticlesActive] = useState(false);
  const [weatherCode, setWeatherCode] = useState(null);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [activeLegendTab, setActiveLegendTab] = useState('unidades');
  const [scannedGrid, setScannedGrid] = useState({ status: 'idle', progress: 0, data: [] });
  const [weatherCanvases, setWeatherCanvases] = useState({});
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [cityHistoryArray, setCityHistoryArray] = useState([]);
  const [timelineIndex, setTimelineIndex] = useState(0);

  // Fetch historical data — prioriza BD local (lecturas del simulador)
  useEffect(() => {
    if (isHistoricalMode && selectedCity) {
      const fetchHistory = async () => {
        // 1. Intentar historial en BD local (datos del simulador)
        try {
          // Buscar localidad_id en la BD por nombre
          const locRes = await fetch(`http://localhost:3000/api/historial`);
          const allData = await locRes.json();

          // Intentar con el nuevo endpoint por ciudad si tiene id numérico de BD
          // El id de la ciudad en el simulador puede no coincidir con localidad_id de BD
          // Usamos el endpoint general y filtramos por nombre
          if (allData && allData.length > 0) {
            const fallbackMapped = allData.map((snapshot, idx) => {
              const cData = snapshot.cities.find(
                c => c.name?.toLowerCase() === selectedCity.name?.toLowerCase()
              );
              return {
                index: idx,
                timestamp: snapshot.timestamp,
                data: cData ? cData.data : null
              };
            }).filter(e => e.data !== null);

            if (fallbackMapped.length > 0) {
              setCityHistoryArray(fallbackMapped);
              setTimelineIndex(fallbackMapped.length - 1);
              return; // BD local tiene datos → no usar Open-Meteo
            }
          }
        } catch (err) {
          console.warn('[Histórico] BD local falló, usando Open-Meteo:', err.message);
        }

        // 2. Fallback: Open-Meteo (clima real si no hay datos simulados)
        try {
          const apiData = await getHistoricalWeatherAtLocation(selectedCity.latitude, selectedCity.longitude);
          if (apiData && apiData.length > 0) {
            setCityHistoryArray(apiData);
            setTimelineIndex(apiData.length - 1);
          } else {
            setCityHistoryArray([]);
          }
        } catch (err) {
          console.error('Historical Fallback failed', err);
          setCityHistoryArray([]);
        }
      };
      fetchHistory();
    }
  }, [isHistoricalMode, selectedCity?.latitude, selectedCity?.longitude]);

  // Se eliminó la vieja carga estática de climas

  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const mapDebounceRef = useRef(null);
  const mapRef = useRef(null);
  const pendingFlyTo = useRef(null); // flyTo pendiente si el mapa aún no cargó

  // Abrir modal o centrar en ciudad inyectada según el estado de navegación o query params
  useEffect(() => {
    if (location.state?.openModal) {
      setIsModalOpen(true)
      window.history.replaceState({}, '')
      return
    }

    const searchParams = new URLSearchParams(location.search);
    const urlCityId = searchParams.get('city');

    const cityIdToOpen = (location.state?.abrirPanel && location.state?.ciudad) || urlCityId;

    if (cityIdToOpen) {
      const city = localidades.find(c => c.id === cityIdToOpen) || simulatedCities.find(c => c.id === cityIdToOpen)
      if (city) {
        setSelectedCity(city)
        if (location.state?.abrirPanel) {
          setInjectedCityId(cityIdToOpen)
          setTimeout(() => setInjectedCityId(null), 4000)
        }

        const flyToParams = { center: [city.longitude, city.latitude], zoom: 8, duration: 1200 }
        if (mapRef.current) {
          mapRef.current.flyTo(flyToParams)
        } else {
          pendingFlyTo.current = flyToParams
        }
      }
      
      if (urlCityId) {
        searchParams.delete('city');
        const newUrl = `${location.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        window.history.replaceState({}, '', newUrl);
      } else {
        window.history.replaceState({}, '')
      }
    }
  }, [location.state, location.search, localidades, simulatedCities]);

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

  // Prioridad: simulación en vivo > último estado BD > localidades base (sin métricas)
  let citiesData = simulatedCities.length > 0
    ? simulatedCities
    : ultimoEstado.length > 0
      ? ultimoEstado
      : localidades;

  // Devuelve la etiqueta de fuente para el badge del marcador.
  // Primero usa fuente_id si el backend lo provee; si no, infiere por el modo activo.
  const getFuenteLabel = (city) => {
    if (city?.fuente_id != null) {
      return city.fuente_id === 1 ? 'En vivo (Simulado)' : 'Dato Real (API)';
    }
    if (isRunning && simulatedCities.length > 0) return 'En vivo (Simulado)';
    if (!isRunning && ultimoEstado.length > 0) return 'Dato Real (API)';
    return null;
  };

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
        aqi: histData.aqi != null ? histData.aqi : '--',
        ica: histData.ica != null ? histData.ica : '--',
        ruido: histData.ruido != null ? histData.ruido : '--',
        humedad: histData.humedad != null ? histData.humedad : '--'
      }
    };
  }

  // Modo oscuro automático cuando el heatmap o el clima 3D está activo — mejora el contraste de colores
  const mapStyle = (isHeatmapActive || isParticlesActive)
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11';

  // Vista centrada en Sudamérica
  const [viewState, setViewState] = useState({
    longitude: -60.0,
    latitude: -20.0,
    zoom: 3.5
  });

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return '#00e400';
    if (aqi <= 100) return '#ffff00';
    if (aqi <= 150) return '#ff7e00';
    return '#ff0000';
  };

  const getDynamicColor = (metricKey, value) => {
    if (value === null || value === undefined || isNaN(value)) return 'var(--ink)';
    if (metricKey === heatmapMetric && umbrales.length > 0) {
      const color = colorPorValor(umbrales, value);
      return color !== '#666' ? color : 'var(--ink)';
    }
    if (metricKey === 'aqi') return getAqiColor(value);
    return 'var(--ink)';
  };

  // Disparo inicial de clima al encender el Switch
  useEffect(() => {
    let intervalId;
    if (isParticlesActive) {
      const fetchRadar = async () => {
        try {
          // Consultar el backend local
          const res = await axios.get('http://localhost:3000/api/radar/bolivia');
          setScannedGrid(res.data);
          
          // Si ya terminó de cargar, detenemos el polling
          if (res.data.status === 'ready') {
            clearInterval(intervalId);
          }
        } catch (e) {
          console.error('Error fetching backend radar:', e);
        }
      };
      
      fetchRadar();
      // Hacer polling cada 1 segundo si está cargando
      intervalId = setInterval(fetchRadar, 1000);
      
      const { longitude, latitude } = mapRef.current ? mapRef.current.getCenter() : viewState;
      getWeatherAtLocation(latitude, longitude).then(w => {
        if (w && w.current) setWeatherCode(w.current.weather_code);
      }).catch(() => { });
    } else {
      setScannedGrid({ status: 'idle', progress: 0, data: [] });
    }
    
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isParticlesActive]);

  const handleMapMoveEnd = async (evt) => {
    if (!isParticlesActive || !mapRef.current) return;
    try {
      const { longitude, latitude } = evt.viewState || viewState;
      const weather = await getWeatherAtLocation(latitude, longitude);
      if (weather && weather.current) {
        setWeatherCode(weather.current.weather_code);
      }
    } catch (err) {
      console.error("Error fetching central weather", err);
    }
  };

  const handleMapClick = async (evt) => {
    const { lng, lat } = evt.lngLat;

    // Primero: buscar la ciudad más cercana en el simulador (radio ~2.5° ≈ 280 km)
    const nearest = citiesData.reduce(
      (best, city) => {
        const d = Math.hypot(city.latitude - lat, city.longitude - lng);
        return d < best.dist ? { city, dist: d } : best;
      },
      { city: null, dist: Infinity }
    );

    if (nearest.city && nearest.dist < 2.5) {
      // Usar datos del simulador directamente
      setSelectedCity({
        ...nearest.city,
        subtitle: `Área de ${nearest.city.name} (simulación)`,
      });
      try {
        const weather = await getWeatherAtLocation(lat, lng);
        if (weather?.current) setWeatherCode(weather.current.weather_code);
      } catch { /* ignorar */ }
      return;
    }

    // Fuera del radio del simulador → consultar APIs externas
    const clickCity = {
      id: `click_${Date.now()}`,
      name: 'Buscando zona...',
      subtitle: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
      latitude: lat,
      longitude: lng,
      data: { temperatura: null, aqi: null, ica: null, ruido: null, humedad: null },
      isLoading: true
    };
    setSelectedCity(clickCity);
    setWeatherCode(null);

    try {
      const [weather, aqiData, placeName] = await Promise.all([
        getWeatherAtLocation(lat, lng),
        getAqiAtLocation(lat, lng),
        getPlaceName(lat, lng, MAPBOX_TOKEN)
      ]);

      let wCode = null;
      const newCityData = { ...clickCity.data };

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
        name: placeName || 'Ubicación Desconocida',
        subtitle: `📡 API externa — Lat: ${lat.toFixed(3)}, Lng: ${lng.toFixed(3)}`,
        data: newCityData,
        isLoading: false
      });
    } catch (e) {
      console.error('Error al obtener datos:', e);
      setSelectedCity({ ...clickCity, name: 'Error en conexión', isLoading: false });
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
          mapStyle={mapStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={handleMapClick}
          projection="mercator"
          maxPitch={0}
          dragRotate={false}
          touchPitch={false}
        >
          <GeolocateControl position="bottom-right" />
          <FullscreenControl position="bottom-right" />
          <NavigationControl position="bottom-right" />

          {/* VoronoiLayer — manto continental activo solo con el heatmap ON */}
          {isHeatmapActive && (
            <VoronoiLayer
              metrica={heatmapMetric}
              umbrales={umbrales}
              cities={citiesData}
              activeFilter={activeUmbralFilter}
            />
          )}

          {isParticlesActive && scannedGrid.status === 'loading' && (
            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#00e5ff', padding: '10px 20px', borderRadius: 30, zIndex: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 15px rgba(0,229,255,0.3)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <span className="spinner" style={{ animation: 'spin 1s linear infinite' }}>📡</span>
              <span>Construyendo Radar de Bolivia... {scannedGrid.progress}%</span>
            </div>
          )}

          {/* Radar Meteorológico Orgánico (3000 puntos desde BD local) */}
          {isParticlesActive && scannedGrid.status === 'ready' && (
            <GridRadarLayer scannedGrid={scannedGrid.data} currentZoom={viewState.zoom} />
          )}

          {/* Marcadores IQAir (círculos numéricos con valor) — en modo heatmap ON */}
          {isHeatmapActive ? (
            <MarkersLayer
              cities={citiesData}
              metrica={heatmapMetric}
              umbrales={umbrales}
              getFuenteLabel={getFuenteLabel}
              onCityClick={async (city) => {
                setSelectedCity(city);
                try {
                  const weather = await getWeatherAtLocation(city.latitude, city.longitude);
                  if (weather && weather.current) setWeatherCode(weather.current.weather_code);
                } catch (err) { console.error(err); }
              }}
            />
          ) : (
            /* Marcadores PIN — en modo heatmap OFF */
            citiesData.map((city) => (
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
                    if (weather?.current) setWeatherCode(weather.current.weather_code);
                  } catch (err) { console.error(err); }
                }}
              >
                <div className={`custom-marker${injectedCityId === city.id ? ' custom-marker--injected' : ''}`}>
                  <span role="img" aria-label="pin">📍</span>
                  {getFuenteLabel(city) && (
                    <span className={`marker-source-badge${isRunning ? ' marker-source-badge--sim' : ' marker-source-badge--real'}`}>
                      {getFuenteLabel(city)}
                    </span>
                  )}
                </div>
              </Marker>
            ))
          )}

        </Map>

        <HeatmapLegend
          metrica={heatmapMetric}
          visible={isHeatmapActive}
          onRangeClick={handleLegendRangeClick}
          onClose={() => setIsHeatmapActive(false)}
          unidad={unidades[heatmapMetric]}
        />

        {/* Panel Flotante de Información — arrastrable, visible en ambos modos */}
        {activeCity && (
          <Draggable className="city-info-panel-wrapper">
            <div className="city-info-panel">
              <button className="close-panel-btn" onClick={() => setSelectedCity(null)} aria-label="Cerrar panel">×</button>
              <div className="panel-header">
                {activeCity.isLoading
                  ? <div className="panel-skeleton-title" />
                  : <h3>{activeCity.name}</h3>
                }
                <p className="panel-subtitle">
                  {activeCity.isLoading
                    ? 'Consultando datos...'
                    : activeCity.subtitle
                      ? <><span className="panel-source-badge">📡 API</span> {activeCity.subtitle}</>
                      : isRunning
                        ? <><span className="panel-source-badge sim">🔬 Simulado</span> Tiempo real</>
                        : 'Datos estáticos'
                  }
                </p>
              </div>
              <div className="panel-body">
                {[
                  { icon: '🌡️', label: 'Temperatura', key: 'temperatura', unit: unidades.temperatura },
                  { icon: '🌫️', label: 'Calidad del Aire', key: 'aqi', unit: unidades.aqi },
                  { icon: '💧', label: 'Calidad del Agua', key: 'ica', unit: unidades.ica },
                  { icon: '🔊', label: 'Nivel de Ruido', key: 'ruido', unit: unidades.ruido },
                  { icon: '💦', label: 'Humedad', key: 'humedad', unit: unidades.humedad },
                ].map(({ icon, label, key, unit }) => (
                  <div key={key} className="data-item">
                    <div className="data-icon">{icon}</div>
                    <div className="data-content">
                      <span className="data-label">{label}</span>
                      {activeCity.isLoading
                        ? <div className="panel-skeleton-value" />
                        : <span className="data-value" style={{ color: getDynamicColor(key, activeCity.data[key]), fontWeight: 'bold' }}>
                          {formatearValor(key, activeCity.data[key], unit)}
                        </span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Draggable>
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
                  <span className="control-text">Clima</span>
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
