/**
 * MapaMonitoreo — Mapa interactivo con marcadores y mapa de calor.
 *
 * Principios aplicados:
 * - SRP: Solo se encarga de renderizar el mapa. Los datos vienen del Context.
 * - DRY: DEPARTAMENTOS_FALLBACK se usa solo como fallback cuando no hay simulación.
 *        Los datos reales vienen de useSimulacion() (misma fuente para todos).
 * - KISS: Misma estructura que antes, solo cambiamos la fuente de datos.
 */
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useLocation } from 'react-router-dom';
import Map, { Marker, NavigationControl, FullscreenControl, GeolocateControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMonitoreo.css';
import { API_BASE } from '../../config/api';
import httpClient from '../../config/httpClient';
import { useSimulacion } from '../../context/SimulacionContext';
import { useZonaSim } from '../../context/ZonaSimContext';
import { useMapVisuals } from '../../context/MapVisualsContext';
import { useTheme } from '../../context/ThemeContext';
import ModalSimulacion from '../../components/ModalSimulacion/ModalSimulacion';
import ModalInyeccion from '../../components/ModalInyeccion/ModalInyeccion';
import Timeline from '../../components/Timeline/Timeline';
import { getWeatherAtLocation, getPlaceName, getHistoricalWeatherAtLocation, getSensoresIoT, getFullDataForPoint } from '../../utils/weatherApi';
import axios from 'axios';
import { useUnidades } from '../../hooks/useUnidades';
import { formatearValor, METRICAS_UNIDADES } from '../../utils/unidades';
import { formatDateTime, formatTime } from '../../utils/formatters';
import HeatmapLegend from './components/HeatmapLegend';
import GeocoderSearch from '../../components/MapaMonitoreo/GeocoderSearch';
import ComparePanel from '../../components/MapaMonitoreo/ComparePanel';
import CityHistoryPanel from '../../components/MapaMonitoreo/CityHistoryPanel';
import WeatherOverlay from '../../components/MapaMonitoreo/WeatherOverlay';
import VoronoiLayer from './layers/VoronoiLayer';
import ChoroplethLayer from './layers/ChoroplethLayer';
import MarkersLayer from './layers/MarkersLayer';
import { useUmbrales, colorPorValor } from '../../hooks/useUmbrales';
import FronterasPanel from '../../components/FronterasPanel/FronterasPanel';
import ControlPanel from '../../components/MapaMonitoreo/ControlPanel';
import { FALLBACK_DATA } from '../../data/fallbackData';

function MapaMonitoreo() {
  const location = useLocation();
  const { theme } = useTheme();

  const { unidades, cambiarUnidad } = useUnidades();
  const [selectedCity, setSelectedCity] = useState(null);

  // ─── Modo Simulación y Estado del Mapa ───────────────────────────────────
  const {
    isRunning, cities: simulatedCities,
    fronterasSeleccionadas, setFronterasSeleccionadas,
    isSimMode, setIsSimMode
  } = useSimulacion();
  const {
    zonaSimActiva, zonaSimZonas = [], zonaSimMetrica,
    zonaSimUnidad, zonaSimEscNombre,
    zonaSimProgreso, zonaSimSesionId, zonaSimTotalLecturas,
    zonaSimTiempo,
    detenerZona, iniciarZona
  } = useZonaSim();
  const {
    isHeatmapActive, setIsHeatmapActive,
    isChoroplethActive, setIsChoroplethActive,
    heatmapMetric, setHeatmapMetric,
    showSensors, setShowSensors,
    isParticlesActive, setIsParticlesActive,
    particleFilters, setParticleFilters,
    isHistoricalMode, setIsHistoricalMode,
    isDynamicHistoricalMode, setIsDynamicHistoricalMode
  } = useMapVisuals();

  // Umbrales dinámicos de la métrica activa — fuente única de verdad para colores
  const { umbrales } = useUmbrales(heatmapMetric || 'aqi');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [fronterasParaSimular, setFronterasParaSimular] = useState([]);
  const [injectedCityId, setInjectedCityId] = useState(null);
  // Sensores IoT — datos reales de la API externa
  const [iotSensors, setIotSensors] = useState([]);
  const [iotLoading, setIotLoading] = useState(true);
  const [activeUmbralFilter, setActiveUmbralFilter] = useState(null);

  // Variables derivadas para el panel de estado (usan la primera zona como resumen)
  const firstZone = (zonaSimZonas && zonaSimZonas[0]) || {};
  const zonaSimColor = firstZone.color || '#38bdf8';
  const zonaSimValor = firstZone.valor ?? null;
  const zonaSimUmbralLabel = firstZone.umbralLabel || '—';

  const handleBoundarySelect = useCallback(({ z1, z2, changed }) => {
    const arr = [];
    if (z1) arr.push(z1);
    if (z2) arr.push(z2);
    setFronterasSeleccionadas(arr);

    // Fitbounds a la zona que acaba de cambiar
    const target = changed === 'z2' ? z2 : z1;
    if (target?.bbox && mapRef.current) {
      mapRef.current.fitBounds(target.bbox, { padding: 40, duration: 1500 });
    }
  }, [setFronterasSeleccionadas]);

  const handleStartSimulation = useCallback((fronteras) => {
    setFronterasParaSimular(fronteras);
    setIsModalOpen(true);
  }, []);

  const handleConfirmSimulation = useCallback((config) => {
    iniciarZona(config);
  }, [iniciarZona]);

  const handleToggleSimMode = useCallback((active) => {
    setIsSimMode(active);
    if (active) setSelectedCity(null);
    // Ya no limpiamos fronterasSeleccionadas para que persistan al volver
  }, []);

  const handleLegendRangeClick = useCallback((umbral) => {
    setActiveUmbralFilter(umbral);
  }, []);

  // --- Estado del buscador geocoder ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [weatherCode, setWeatherCode] = useState(null);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [activeLegendTab, setActiveLegendTab] = useState('unidades');
  const [scannedGrid, setScannedGrid] = useState({ status: 'idle', progress: 0, data: [] });
  const [weatherCanvases, setWeatherCanvases] = useState({});
  const [isFetchingRadar, setIsFetchingRadar] = useState(false);

  const [cityHistoryArray, setCityHistoryArray] = useState([]);
  const [timelineIndex, setTimelineIndex] = useState(0);

  const [globalHistoryArray, setGlobalHistoryArray] = useState([]);
  const [globalTimelineIndex, setGlobalTimelineIndex] = useState(0);
  const [availableRadarDates, setAvailableRadarDates] = useState([]);

  // --- Estados de Modo Comparar (Fase 2) ---
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareIndexA, setCompareIndexA] = useState(null); 
  const [compareIndexB, setCompareIndexB] = useState(null); 
  const [swipePos, setSwipePos] = useState(50);
  const [scannedGridA, setScannedGridA] = useState({ status: 'idle', data: [] });
  const [scannedGridB, setScannedGridB] = useState({ status: 'idle', data: [] });

  // Fetch available dates from backend
  const fetchAvailableDates = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/radar/available-dates`);
      setAvailableRadarDates(res.data);
    } catch (e) {
      console.error('Error fetching available dates', e);
    }
  }, []);

  useEffect(() => {
    fetchAvailableDates();
    const interval = setInterval(fetchAvailableDates, 30000); // Cada 30s
    return () => clearInterval(interval);
  }, [fetchAvailableDates]);

  // Generate global history array for the last 3 days + next 24h
  useEffect(() => {
    const arr = [];
    const now = new Date();

    // Inicio: Hace 3 días a las 00:00
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 3);
    start.setUTCHours(0, 0, 0, 0);

    // Fin: Dentro de 24 horas
    const futureEnd = new Date(now);
    futureEnd.setUTCDate(futureEnd.getUTCDate() + 1);
    futureEnd.setUTCHours(23, 0, 0, 0);

    let index = 0;
    let curr = start;
    let initialIndex = 0;
    const nowTs = now.getTime();
    let minDiff = Infinity;

    while (curr <= futureEnd) {
      const ts = curr.getTime();
      const diff = Math.abs(ts - nowTs);

      // Encontrar el índice más cercano al momento actual para seleccionarlo por defecto
      if (diff < minDiff) {
        minDiff = diff;
        initialIndex = index;
      }

      const isAvailable = availableRadarDates.some(d => {
        const d1 = new Date(d).getTime();
        const d2 = curr.getTime();
        return Math.abs(d1 - d2) < 1000 * 60 * 60; // Tolerancia de 1 hora
      });

      arr.push({
        index,
        timestamp: curr.toISOString(),
        isPrediction: curr > now,
        isAvailable: isAvailable || curr < now, // Por ahora el pasado lo consideramos disponible (fallback)
        data: { temperatura: null }
      });

      curr = new Date(curr.getTime() + 3 * 60 * 60 * 1000); // Pasos de 3h para coincidir con NOAA
      index++;
    }
    setGlobalHistoryArray(arr);
    // Solo establecer el índice inicial la primera vez para no perder la selección del usuario
    setGlobalTimelineIndex(prev => prev === 0 ? initialIndex : prev);
  }, [availableRadarDates]);

  // Fetch historical data — prioriza BD local (lecturas del simulador)
  useEffect(() => {
    if (isHistoricalMode && selectedCity) {
      const fetchHistory = async () => {
        // 1. Intentar historial en BD local (datos del simulador)
        try {
          // Buscar localidad_id en la BD por nombre
          const { data: allData } = await httpClient.get('/historial');

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
  }, [isHistoricalMode, selectedCity]);

  // Se eliminó la vieja carga estática de climas

  const mapDebounceRef = useRef(null);
  const mapRef = useRef(null);
  const pendingFlyTo = useRef(null); // flyTo pendiente si el mapa aún no cargó
  const containerRef = useRef(null); // ref para el ResizeObserver

  // ResizeObserver para arreglar el lag del canvas cuando se encoge el panel lateral
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        requestAnimationFrame(() => {
          mapRef.current.resize();
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
      const city = FALLBACK_DATA.find(c => c.id === cityIdToOpen)
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
  }, [location.state, location.search]);

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

  const handleSelectResult = (result) => {
    const [lng, lat] = result.center;
    const placeType = result.place_type?.[0] || '';
    let zoom = 10;
    if (placeType === 'country') zoom = 4;
    else if (placeType === 'region') zoom = 6;
    else if (placeType === 'district' || placeType === 'locality') zoom = 8;
    else if (placeType === 'place') zoom = 10;
    else if (placeType === 'address' || placeType === 'poi') zoom = 14;

    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500 });

    const matchedCity = citiesData.find(c =>
      c.name.toLowerCase() === result.text?.toLowerCase() ||
      result.place_name?.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matchedCity) {
      setSelectedCity(matchedCity);
    } else {
      setSelectedCity(null);
    }
  };

  const [dynamicWindLabels, setDynamicWindLabels] = useState(null);

  useEffect(() => {
    if (!scannedGrid?.data || !isParticlesActive || !particleFilters.wind) return;
    
    let activeCities = simulatedCities.length > 0 ? simulatedCities : (iotSensors.length > 0 ? iotSensors : FALLBACK_DATA);

    const newFeatures = activeCities.map((city) => {
      let nearestCell = null;
      let minDist = Infinity;
      const lng = city.longitude;
      const lat = city.latitude;
      
      const roughGrid = scannedGrid.data.filter(c => Math.abs(c.latitud - lat) < 1.5 && Math.abs(c.longitud - lng) < 1.5);
      const searchSpace = roughGrid.length > 0 ? roughGrid : scannedGrid.data;

      searchSpace.forEach(cell => {
        const dist = Math.hypot(cell.latitud - lat, cell.longitud - lng);
        if (dist < minDist) {
          minDist = dist;
          nearestCell = cell;
        }
      });

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { 
          name: city.name || city.ciudad || 'Desconocido', 
          wind_speed: nearestCell ? nearestCell.wind_speed : 0 
        }
      };
    });

    setDynamicWindLabels({ type: 'FeatureCollection', features: newFeatures });
  }, [scannedGrid, simulatedCities, iotSensors, isParticlesActive, particleFilters.wind]);

  // Cargar sensores IoT al montar el componente y refrescar cada 15 min
  useEffect(() => {
    const loadSensors = async () => {
      setIotLoading(true);
      const data = await getSensoresIoT();
      if (data && data.length > 0) setIotSensors(data);
      setIotLoading(false);
    };
    loadSensors();
    const interval = setInterval(loadSensors, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Usar datos del contexto si existen (simulación activa), sino sensores IoT reales, sino fallback estático
  let citiesData = simulatedCities.length > 0 ? simulatedCities : (iotSensors.length > 0 ? iotSensors : FALLBACK_DATA);

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
  const mapStyle = theme === 'dark'
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
          if (isDynamicHistoricalMode) setIsFetchingRadar(true);

          if (isCompareMode) {
            // --- MODO COMPARAR: Descarga A y B ---
            const fetchSide = async (timeIndex, setter) => {
              const entry = globalHistoryArray[timeIndex];
              if (!entry) return;
              let url = entry.isPrediction ? `${API_BASE}/radar/prediction` : `${API_BASE}/radar/bolivia`;
              const r = await axios.get(url, { params: { time: entry.timestamp } });
              setter(r.data);
              return r.data.status;
            };

            const [statusA, statusB] = await Promise.all([
              fetchSide(compareIndexA ?? globalTimelineIndex, setScannedGridA),
              fetchSide(compareIndexB ?? globalTimelineIndex, setScannedGridB)
            ]);

            if (statusA === 'ready' && statusB === 'ready') {
              clearInterval(intervalId);
              setIsFetchingRadar(false);
            }
          } else {
            // --- MODO NORMAL ---
            let url = `${API_BASE}/radar/bolivia`;
            const selectedEntry = globalHistoryArray[globalTimelineIndex];

            if (isDynamicHistoricalMode && selectedEntry) {
              if (selectedEntry.isPrediction) url = `${API_BASE}/radar/prediction`;
              url += `?time=${encodeURIComponent(selectedEntry.timestamp)}`;
            }

            const res = await axios.get(url);
            setScannedGrid(res.data);

            if (res.data.status === 'ready') {
              clearInterval(intervalId);
              setIsFetchingRadar(false);
            } else {
              setIsFetchingRadar(true);
            }
          }
        } catch (e) {
          console.error('Error fetching radar:', e);
          setIsFetchingRadar(false);
        }
      };

      fetchRadar();
      intervalId = setInterval(fetchRadar, 1000);
    } else {
      setScannedGrid({ status: 'idle', progress: 0, data: [] });
      setScannedGridA({ status: 'idle', data: [] });
      setScannedGridB({ status: 'idle', data: [] });
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isParticlesActive, isCompareMode, isDynamicHistoricalMode, globalTimelineIndex, compareIndexA, compareIndexB, globalHistoryArray]);

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

    // ─── Modo Simulación: salir (ahora las zonas se manejan por FronterasPanel) ───
    if (isSimMode) {
      return;
    }

    // Primero: buscar la ciudad más cercana en el simulador (radio ~2.5° ≈ 280 km)
    const nearest = citiesData.reduce(
      (best, city) => {
        const d = Math.hypot(city.latitude - lat, city.longitude - lng);
        return d < best.dist ? { city, dist: d } : best;
      },
      { city: null, dist: Infinity }
    );

    if (nearest.city && nearest.dist < 2.5) {
      // Usar datos del sensor IoT / simulador más cercano
      const sourceLabel = isRunning ? 'simulación' : '📡 Sensor IoT';
      setSelectedCity({
        ...nearest.city,
        subtitle: `Área de ${nearest.city.name} — ${sourceLabel}`,
      });
      try {
        const weather = await getWeatherAtLocation(lat, lng);
        if (weather?.current) {
          setWeatherCode(weather.current.weather_code);
          setSelectedCity(prev => prev ? {
            ...prev,
            data: {
              ...prev.data,
              windSpeed: weather.current.wind_speed_10m
            }
          } : null);
        }
      } catch (err) {
        console.warn('Weather fetch skipped for sensor-radius area:', err.message);
      }
      return;
    }

    // Fuera del radio de sensores → consultar backend (datos reales completos)
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
      // getFullDataForPoint devuelve temperatura, humedad, aqi, ica y ruido
      const [fullData, placeName] = await Promise.all([
        getFullDataForPoint(lat, lng),
        getPlaceName(lat, lng, MAPBOX_TOKEN)
      ]);

      const newCityData = {
        temperatura: fullData?.temperatura ?? null,
        humedad: fullData?.humedad ?? null,
        aqi: fullData?.aqi ?? null,
        ica: fullData?.ica ?? null,
        ruido: fullData?.ruido ?? null,
        windSpeed: fullData?.windSpeed ?? null,
      };

      setWeatherCode(fullData?.weatherCode ?? null);
      setSelectedCity({
        ...clickCity,
        name: placeName || 'Ubicación Desconocida',
        subtitle: `📡 Sensor IoT — Lat: ${lat.toFixed(3)}, Lng: ${lng.toFixed(3)}`,
        data: newCityData,
        isLoading: false
      });
    } catch (e) {
      console.error('Error al obtener datos:', e);
      setSelectedCity({ ...clickCity, name: 'Error en conexión', isLoading: false });
    }
  };

  // Contar cuántos controles están activos para el badge
  const activeControlsCount = [isParticlesActive, isHeatmapActive, isChoroplethActive, isHistoricalMode, showSensors, isSimMode].filter(Boolean).length;

  return (
    <div className="mapa-page-container" ref={containerRef}>
      <ModalSimulacion
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        fronteras={fronterasParaSimular}
        onStart={handleConfirmSimulation}
      />
      <ModalInyeccion
        isOpen={isInjectModalOpen}
        onClose={() => setIsInjectModalOpen(false)}
      />
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

      <div className={`map-container${isSimMode ? ' sim-mode' : ''}`}>
        {isSimMode && (
          <FronterasPanel
            onBoundarySelect={handleBoundarySelect}
            onStartSimulation={handleStartSimulation}
            isRunning={zonaSimActiva}
          />
        )}
        <GeocoderSearch
          MAPBOX_TOKEN={MAPBOX_TOKEN}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showResults={showResults}
          setShowResults={setShowResults}
          searchResults={searchResults}
          setSearchResults={setSearchResults}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          onSelectResult={handleSelectResult}
        />
        {/* Contenedor del Mapa con soporte para Comparar (Swipe) */}
        <div className="map-main-wrapper" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          
          {/* MAPA A (Fondo / Izquierda / Tiempo A) */}
          <Map
            id="mapA"
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
            maxZoom={9}
            minZoom={2.5}
            maxPitch={0}
            dragRotate={false}
            touchPitch={false}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            <GeolocateControl position="bottom-left" />
            <FullscreenControl position="bottom-left" />
            <NavigationControl position="bottom-left" />

            {/* Fronteras (A) */}
            {(isSimMode || zonaSimActiva) && fronterasSeleccionadas.map((frontera, idx) => {
              const simData = zonaSimZonas.find(z => z.nombre === frontera.nombre);
              const color = simData?.color || (idx === 0 ? '#38bdf8' : '#a855f7');
              return (
                <Fragment key={`frontera-a-${idx}`}>
                  <Source id={`frontera-source-a-${idx}`} type="geojson" data={frontera.geojson}>
                    <Layer id={`frontera-fill-a-${idx}`} type="fill" paint={{ 'fill-color': color, 'fill-opacity': simData ? 0.3 : 0.2 }} />
                    <Layer id={`frontera-line-a-${idx}`} type="line" paint={{ 'line-color': color, 'line-width': 2 }} />
                  </Source>
                </Fragment>
              );
            })}

            {/* Capas Globales (A) */}
            {isHeatmapActive && (
              <VoronoiLayer
                metrica={heatmapMetric}
                umbrales={umbrales}
                cities={citiesData}
                activeFilter={activeUmbralFilter}
              />
            )}
            {isChoroplethActive && (
              <ChoroplethLayer
                metrica={heatmapMetric}
                umbrales={umbrales}
                cities={citiesData}
                activeFilter={activeUmbralFilter}
              />
            )}
            
            {showSensors && (
              isHeatmapActive ? (
                <MarkersLayer
                  cities={citiesData}
                  metrica={heatmapMetric}
                  umbrales={umbrales}
                  activeFilter={activeUmbralFilter}
                  unidad={unidades[heatmapMetric]}
                  currentZoom={viewState.zoom}
                  onCityClick={async (city) => {
                    setSelectedCity(city);
                    try {
                      const weather = await getWeatherAtLocation(city.latitude, city.longitude);
                      if (weather && weather.current) {
                        setWeatherCode(weather.current.weather_code);
                        setSelectedCity(prev => prev ? {
                          ...prev,
                          data: {
                            ...prev.data,
                            windSpeed: weather.current.wind_speed_10m
                          }
                        } : null);
                      }
                    } catch (err) { console.error(err); }
                  }}
                />
              ) : (
                citiesData.map((city) => (
                  <Marker
                    key={`marker-a-${city.id}`}
                    longitude={city.longitude}
                    latitude={city.latitude}
                    anchor="bottom"
                    onClick={async (e) => {
                      e.originalEvent.stopPropagation();
                      setSelectedCity(city);
                      try {
                        const weather = await getWeatherAtLocation(city.latitude, city.longitude);
                        if (weather?.current) {
                          setWeatherCode(weather.current.weather_code);
                          setSelectedCity(prev => prev ? {
                            ...prev,
                            data: {
                              ...prev.data,
                              windSpeed: weather.current.wind_speed_10m
                            }
                          } : null);
                        }
                      } catch (err) { console.error(err); }
                    }}
                  >
                    <div className={`custom-marker sensor-iot-marker${injectedCityId === city.id ? ' custom-marker--injected' : ''}`}>
                      <span role="img" aria-label="sensor" style={{ fontSize: '20px', filter: 'drop-shadow(0 0 4px rgba(0,229,255,0.8))' }}>📡</span>
                    </div>
                  </Marker>
                ))
              )
            )}

            <WeatherOverlay
              scannedGrid={isCompareMode ? scannedGridA.data : scannedGrid.data}
              currentZoom={viewState.zoom}
              particleFilters={particleFilters}
              isParticlesActive={isParticlesActive}
              dynamicWindLabels={dynamicWindLabels}
            />
          </Map>

          {isCompareMode && (
            <ComparePanel
              swipePos={swipePos}
              setSwipePos={setSwipePos}
              compareIndexA={compareIndexA}
              compareIndexB={compareIndexB}
              globalHistoryArray={globalHistoryArray}
              formatTime={formatTime}
            >
              <Map
                id="mapB"
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                mapStyle={mapStyle}
                mapboxAccessToken={MAPBOX_TOKEN}
                projection="mercator"
                maxZoom={9}
                minZoom={2.5}
                dragRotate={false}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}
              >
                {/* Fronteras (B) */}
                {(isSimMode || zonaSimActiva) && fronterasSeleccionadas.map((frontera, idx) => {
                  const simData = zonaSimZonas.find(z => z.nombre === frontera.nombre);
                  const color = simData?.color || (idx === 0 ? '#38bdf8' : '#a855f7');
                  return (
                    <Fragment key={`frontera-b-${idx}`}>
                      <Source id={`frontera-source-b-${idx}`} type="geojson" data={frontera.geojson}>
                        <Layer id={`frontera-fill-b-${idx}`} type="fill" paint={{ 'fill-color': color, 'fill-opacity': simData ? 0.3 : 0.2 }} />
                        <Layer id={`frontera-line-b-${idx}`} type="line" paint={{ 'line-color': color, 'line-width': 2 }} />
                      </Source>
                    </Fragment>
                  );
                })}

                {/* Capas Globales (B) */}
                {isHeatmapActive && (
                  <VoronoiLayer
                    metrica={heatmapMetric}
                    umbrales={umbrales}
                    cities={citiesData}
                    activeFilter={activeUmbralFilter}
                  />
                )}
                {isChoroplethActive && (
                  <ChoroplethLayer
                    metrica={heatmapMetric}
                    umbrales={umbrales}
                    cities={citiesData}
                    activeFilter={activeUmbralFilter}
                  />
                )}
                
                {showSensors && (
                  isHeatmapActive ? (
                    <MarkersLayer
                      cities={citiesData}
                      metrica={heatmapMetric}
                      umbrales={umbrales}
                      activeFilter={activeUmbralFilter}
                      unidad={unidades[heatmapMetric]}
                      currentZoom={viewState.zoom}
                      onCityClick={async (city) => {
                        setSelectedCity(city);
                        try {
                          const weather = await getWeatherAtLocation(city.latitude, city.longitude);
                          if (weather && weather.current) setWeatherCode(weather.current.weather_code);
                        } catch (err) { console.error(err); }
                      }}
                    />
                  ) : (
                    citiesData.map((city) => (
                      <Marker
                        key={`marker-b-${city.id}`}
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
                        <div className={`custom-marker sensor-iot-marker${injectedCityId === city.id ? ' custom-marker--injected' : ''}`}>
                          <span role="img" aria-label="sensor" style={{ fontSize: '20px', filter: 'drop-shadow(0 0 4px rgba(0,229,255,0.8))' }}>📡</span>
                        </div>
                      </Marker>
                    ))
                  )
                )}

                <WeatherOverlay
                  scannedGrid={scannedGridB.data}
                  currentZoom={viewState.zoom}
                  particleFilters={particleFilters}
                  isParticlesActive={isParticlesActive}
                  dynamicWindLabels={dynamicWindLabels}
                />
              </Map>
            </ComparePanel>
          )}
        </div>

        <HeatmapLegend
          metrica={heatmapMetric}
          visible={isHeatmapActive}
          onRangeClick={handleLegendRangeClick}
          onClose={() => setIsHeatmapActive(false)}
          unidad={unidades[heatmapMetric]}
        />

        <CityHistoryPanel
          activeCity={activeCity}
          setSelectedCity={setSelectedCity}
          isRunning={isRunning}
          unidades={unidades}
          formatearValor={formatearValor}
          getDynamicColor={getDynamicColor}
        />

        <ControlPanel
          activeControlsCount={activeControlsCount}
          setIsInjectModalOpen={setIsInjectModalOpen}
          isSimMode={isSimMode} handleToggleSimMode={handleToggleSimMode}
          isParticlesActive={isParticlesActive} setIsParticlesActive={setIsParticlesActive}
          isHeatmapActive={isHeatmapActive} setIsHeatmapActive={setIsHeatmapActive}
          heatmapMetric={heatmapMetric} setHeatmapMetric={setHeatmapMetric}
          isChoroplethActive={isChoroplethActive} setIsChoroplethActive={setIsChoroplethActive}
          isHistoricalMode={isHistoricalMode} setIsHistoricalMode={setIsHistoricalMode}
          showSensors={showSensors} setShowSensors={setShowSensors} setSelectedCity={setSelectedCity}
          iotLoading={iotLoading}
          unidades={unidades} cambiarUnidad={cambiarUnidad} METRICAS_UNIDADES={METRICAS_UNIDADES}
          isDynamicHistoricalMode={isDynamicHistoricalMode} setIsDynamicHistoricalMode={setIsDynamicHistoricalMode}
          isCompareMode={isCompareMode} setIsCompareMode={setIsCompareMode}
          compareIndexA={compareIndexA} compareIndexB={compareIndexB}
          setCompareIndexA={setCompareIndexA} setCompareIndexB={setCompareIndexB}
          globalTimelineIndex={globalTimelineIndex} globalHistoryArray={globalHistoryArray}
          particleFilters={particleFilters} setParticleFilters={setParticleFilters}
        />
      </div>



      {isDynamicHistoricalMode && (
        <>
          <div className="historical-prompt">
            <span style={{ fontSize: '1.2rem', marginBottom: '5px' }}>⏳ Histórico Global Activado</span>
            <span style={{ opacity: 0.8 }}>Mostrando el clima global en la fecha seleccionada.</span>
          </div>
          <Timeline
            cityHistoryArray={globalHistoryArray}
            currentIndex={globalTimelineIndex}
            onIndexChange={(idx) => setGlobalTimelineIndex(idx)}
            isGlobal={true}
            isCompareMode={isCompareMode}
            compareIndexA={compareIndexA}
            compareIndexB={compareIndexB}
            onCompareIndexChange={(side, idx) => {
              if (side === 'A') setCompareIndexA(idx);
              else setCompareIndexB(idx);
            }}
          />
        </>
      )}

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

      {/* ─── Panel flotante de estado de simulación de zona ────────── */}
      {zonaSimActiva && (
        <div className="zona-sim-status-panel">
          {/* Header */}
          <div className="zona-sim-header">
            <div className="zona-sim-pulse">
              <span className="zona-sim-dot" style={{ background: zonaSimColor || '#38bdf8' }} />
            </div>
            <span className="zona-sim-title">Simulación Activa</span>
            <button className="zona-sim-close-btn" onClick={detenerZona} title="Detener simulación">
              ⏹
            </button>
          </div>

          {/* Valor actual */}
          <div className="zona-sim-valor-row">
            <div
              className="zona-sim-valor-big"
              style={{ color: zonaSimColor || '#38bdf8' }}
            >
              {zonaSimValor !== null ? zonaSimValor : '—'}
              <span className="zona-sim-unidad">{zonaSimUnidad}</span>
            </div>
            <div className="zona-sim-badge-wrap">
              <span
                className="zona-sim-severity-badge"
                style={{ background: `${zonaSimColor || '#38bdf8'}22`, color: zonaSimColor || '#38bdf8', borderColor: `${zonaSimColor || '#38bdf8'}55` }}
              >
                {zonaSimUmbralLabel || '—'}
              </span>
            </div>
          </div>

          {/* Info del escenario */}
          <div className="zona-sim-info-row">
            <span className="zona-sim-info-label">Escenario</span>
            <span className="zona-sim-info-val">{zonaSimEscNombre || '—'}</span>
          </div>
          <div className="zona-sim-info-row">
            <span className="zona-sim-info-label">Métrica</span>
            <span className="zona-sim-info-val">{zonaSimMetrica} ({zonaSimUnidad})</span>
          </div>
          <div className="zona-sim-info-row">
            <span className="zona-sim-info-label">Fecha/Hora Sim</span>
            <span className="zona-sim-info-val">{formatDateTime(zonaSimTiempo)}</span>
          </div>

          {/* Barra de progreso */}
          <div className="zona-sim-progress-wrap">
            <div className="zona-sim-progress-label">
              <span>Progreso</span>
              <span>{zonaSimProgreso}%</span>
            </div>
            <div className="zona-sim-progress-bar">
              <div
                className="zona-sim-progress-fill"
                style={{
                  width: `${zonaSimProgreso}%`,
                  background: zonaSimColor || '#38bdf8',
                }}
              />
            </div>
          </div>

          {/* Confirmación BD */}
          {zonaSimSesionId && (
            <div className="zona-sim-db-badge">
              <span className="zona-sim-db-icon">✓</span>
              <span>
                <strong>{zonaSimTotalLecturas}</strong> lecturas guardadas en BD
                &nbsp;·&nbsp; sesión #{zonaSimSesionId}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MapaMonitoreo;
