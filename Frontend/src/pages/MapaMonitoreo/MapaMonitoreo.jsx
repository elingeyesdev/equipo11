/**
 * MapaMonitoreo — Mapa interactivo con marcadores y mapa de calor.
 *
 * Principios aplicados:
 * - SRP: Solo se encarga de renderizar el mapa. Los datos vienen del Context.
 * - DRY: DEPARTAMENTOS_FALLBACK se usa solo como fallback cuando no hay simulación.
 *        Los datos reales vienen de useSimulacion() (misma fuente para todos).
 * - KISS: Misma estructura que antes, solo cambiamos la fuente de datos.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Map, { NavigationControl, FullscreenControl, GeolocateControl, Popup, Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMonitoreo.css';
import { useSimulacion } from '../../context/SimulacionContext';
import { useZonaSim } from '../../context/ZonaSimContext';
import { useMapVisuals } from '../../context/MapVisualsContext';
import { useTheme } from '../../context/ThemeContext';
import ModalSimulacion from '../../components/ModalSimulacion/ModalSimulacion';
import ModalInyeccion from '../../components/ModalInyeccion/ModalInyeccion';
import ModalSensor from '../../components/ModalSensor/ModalSensor';
import Timeline from '../../components/Timeline/Timeline';
import TimePlayer from '../../components/TimePlayer/TimePlayer';
import { getWeatherAtLocation, getPlaceName, getFullDataForPoint } from '../../utils/weatherApi';
import { useUnidades } from '../../hooks/useUnidades';
import { formatearValor, METRICAS_UNIDADES } from '../../utils/unidades';
import { formatTime } from '../../utils/formatters';
import HeatmapLegend from './components/HeatmapLegend';
import GeocoderSearch from '../../components/MapaMonitoreo/GeocoderSearch';
import ComparePanel from '../../components/MapaMonitoreo/ComparePanel';
import CityHistoryPanel from '../../components/MapaMonitoreo/CityHistoryPanel';
import MapLayers from '../../components/MapaMonitoreo/MapLayers';
import useRadarData from '../../hooks/useRadarData';
import useCityHistory from '../../hooks/useCityHistory';
import useSensors from '../../hooks/useSensors';
import { useUmbrales, colorPorValor } from '../../hooks/useUmbrales';
import FronterasPanel from '../../components/FronterasPanel/FronterasPanel';
import ControlPanel from '../../components/MapaMonitoreo/ControlPanel';
import SimulationStatus from '../../components/MapaMonitoreo/SimulationStatus';
import { FALLBACK_DATA } from '../../data/fallbackData';
import { getImageDataArray, sampleWindBilinear, sampleRainBilinear, sampleSnowBilinear, sampleVisibilityBilinear, sampleTempBilinear, sampleAqiNearest } from '../../utils/windMath';

const updateManualResult = (points, isZ2, customName) => {
  if (!points || points.length < 3) return null;
  const minLng = Math.min(...points.map(p => p[0]));
  const maxLng = Math.max(...points.map(p => p[0]));
  const minLat = Math.min(...points.map(p => p[1]));
  const maxLat = Math.max(...points.map(p => p[1]));
  const bbox = [[minLng, minLat], [maxLng, maxLat]];
  const closedPoints = [...points, points[0]];
  const name = customName || (isZ2 ? "Zona Manual 2" : "Zona Manual 1");
  return {
    geojson: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [closedPoints]
        },
        properties: { name: name }
      }]
    },
    bbox: bbox,
    nombre: name
  };
};

const getManualGeoJSON = (points) => {
  if (!points || points.length < 2) return { type: 'FeatureCollection', features: [] };
  if (points.length < 3) {
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: points
        }
      }]
    };
  }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[...points, points[0]]]
      }
    }]
  };
};

function MapaMonitoreo() {
  const location = useLocation();
  const { theme } = useTheme();

  const { unidades, cambiarUnidad } = useUnidades();
  const [selectedCity, setSelectedCity] = useState(null);
  const [scalarPopup, setScalarPopup] = useState(null);

  // ─── Modo Simulación y Estado del Mapa ───────────────────────────────────
  const {
    isRunning, cities: simulatedCities,
    fronterasSeleccionadas, setFronterasSeleccionadas,
    isSimMode, setIsSimMode,
    zona1Cfg, setZona1Cfg,
    zona2Cfg, setZona2Cfg,
    activeDrawingZone, setActiveDrawingZone
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
  const [isSensorModalOpen, setIsSensorModalOpen] = useState(false);
  const [isSelectingSensorLocation, setIsSelectingSensorLocation] = useState(false);
  const [sensorCoords, setSensorCoords] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [fronterasParaSimular, setFronterasParaSimular] = useState([]);
  const [injectedCityId, setInjectedCityId] = useState(null);
  const [activeUmbralFilter, setActiveUmbralFilter] = useState(null);

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
  const [weatherCanvases, setWeatherCanvases] = useState({});

  const { cityHistoryArray, timelineIndex, setTimelineIndex } = useCityHistory({ isHistoricalMode, selectedCity });

  // --- Estados de Modo Comparar (Fase 2) ---
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareIndexA, setCompareIndexA] = useState(null); 
  const [compareIndexB, setCompareIndexB] = useState(null); 
  const [swipePos, setSwipePos] = useState(50);

  const {
    availableRadarDates,
    globalHistoryArray, globalTimelineIndex, setGlobalTimelineIndex,
    scannedGrid, scannedGridA, scannedGridB,
    isFetchingRadar, setCorruptedDates
  } = useRadarData({ isParticlesActive, isCompareMode, compareIndexA, compareIndexB, isDynamicHistoricalMode });

  const { iotSensors, iotLoading, dynamicWindLabels, citiesData, addSensorLocally } = useSensors({ scannedGrid, simulatedCities, isParticlesActive, particleFilters, refreshTrigger });

  const mapDebounceRef = useRef(null);
  const mapRef = useRef(null);
  const pendingFlyTo = useRef(null); // flyTo pendiente si el mapa aún no cargó
  const containerRef = useRef(null); // ref para el ResizeObserver

  // --- Extracción de Uint8ClampedArray de los PNGs (0% CPU O(1) Lookups) ---
  const windData = useMemo(() => scannedGrid?.data?.windImg ? getImageDataArray(scannedGrid.data.windImg) : null, [scannedGrid]);
  const rainData = useMemo(() => scannedGrid?.data?.rainImg ? getImageDataArray(scannedGrid.data.rainImg) : null, [scannedGrid]);
  const snowData = useMemo(() => scannedGrid?.data?.snowImg ? getImageDataArray(scannedGrid.data.snowImg) : null, [scannedGrid]);
  const visData = useMemo(() => scannedGrid?.data?.visImg ? getImageDataArray(scannedGrid.data.visImg) : null, [scannedGrid]);
  const tempData = useMemo(() => scannedGrid?.data?.tempImg ? getImageDataArray(scannedGrid.data.tempImg) : null, [scannedGrid]);
  const aqiData = useMemo(() => scannedGrid?.data?.aqiImg ? getImageDataArray(scannedGrid.data.aqiImg) : null, [scannedGrid]);

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
    if (aqi >= 300) return '#7e0023';
    if (aqi >= 200) return '#8f3f97';
    if (aqi >= 150) return '#ff0000';
    if (aqi >= 100) return '#ff7e00';
    if (aqi >= 50) return '#ffff00';
    if (aqi >= 30) return '#00e400';
    if (aqi >= 10) return '#7dd3ff';
    return '#e0f2ff';
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

  const handleMapMoveEnd = async (evt) => {
    if (!isParticlesActive || !mapRef.current) return;
    try {
      const { longitude, latitude } = evt.viewState || viewState;
      const weather = await getWeatherAtLocation(latitude, longitude);
      if (weather && weather.current) {
        setWeatherCode(weather.current.weather_code);
      }
    } catch (err) {
      console.warn("Error silenciado en Open-Meteo:", err);
    }
  };

  // Sincronización del Popup con los toggles de las capas
  useEffect(() => {
    if (!scalarPopup) return;
    
    const aqiActive = (isParticlesActive && particleFilters.aqi) || (isHeatmapActive && heatmapMetric === 'aqi');
    
    // Si la visualización principal está apagada, cerramos el popup
    if (!isParticlesActive && !isHeatmapActive) {
      setScalarPopup(null);
      return;
    }

    const nextMetrics = [];
    // Revisamos qué métricas del popup actual siguen estando activas en los filtros
    for (const metric of scalarPopup.metrics) {
      if (metric.label === 'Viento' && isParticlesActive && particleFilters.wind) nextMetrics.push(metric);
      if (metric.label === 'Precipitación' && isParticlesActive && particleFilters.rain) nextMetrics.push(metric);
      if (metric.label.includes('Nieve') && isParticlesActive && particleFilters.snow) nextMetrics.push(metric);
      if (metric.label === 'Visibilidad' && isParticlesActive && particleFilters.fog) nextMetrics.push(metric);
      if (metric.label === 'Temperatura' && isParticlesActive && particleFilters.temp) nextMetrics.push(metric);
      if (metric.label === 'Calidad del Aire (AQI)' && aqiActive) nextMetrics.push(metric);
    }

    if (nextMetrics.length === 0) {
      setScalarPopup(null);
    } else if (nextMetrics.length !== scalarPopup.metrics.length) {
      setScalarPopup(prev => ({ ...prev, metrics: nextMetrics }));
    }
  }, [isParticlesActive, isHeatmapActive, heatmapMetric, particleFilters, scalarPopup]);

  const handleMapClick = async (evt) => {
    const { lng, lat } = evt.lngLat;
    console.log("[DEBUG DRAW] handleMapClick triggered:", { lng, lat, isSimMode, activeDrawingZone, zona1CfgPoints: zona1Cfg?.manualPoints });

    // ─── Modo Selección de Ubicación de Sensor ───
    if (isSelectingSensorLocation) {
      setSensorCoords({ lat, lng });
      setIsSelectingSensorLocation(false);
      setIsSensorModalOpen(true);
      return;
    }

    // ─── Modo Simulación ───
    if (isSimMode) {
      if (activeDrawingZone === 'z1') {
        const nextPoints = [...zona1Cfg.manualPoints, [lng, lat]];
        const updatedZ1 = {
          ...zona1Cfg,
          manualPoints: nextPoints,
          result: updateManualResult(nextPoints, false, zona1Cfg.manualName)
        };
        setZona1Cfg(updatedZ1);
        handleBoundarySelect({ z1: updatedZ1.result, z2: zona2Cfg.result, changed: 'z1' });
        return;
      }
      if (activeDrawingZone === 'z2') {
        const nextPoints = [...zona2Cfg.manualPoints, [lng, lat]];
        const updatedZ2 = {
          ...zona2Cfg,
          manualPoints: nextPoints,
          result: updateManualResult(nextPoints, true, zona2Cfg.manualName)
        };
        setZona2Cfg(updatedZ2);
        handleBoundarySelect({ z1: zona1Cfg.result, z2: updatedZ2.result, changed: 'z2' });
        return;
      }
      return;
    }

    // Interpolar de forma instantánea escalar/vectorial
    const localWind = windData ? sampleWindBilinear(windData, lng, lat) : null;
    const localRain = rainData ? sampleRainBilinear(rainData, lng, lat) : null;
    const localSnow = snowData ? sampleSnowBilinear(snowData, lng, lat) : null;
    const localVisRaw = visData ? sampleVisibilityBilinear(visData, lng, lat) : null;
    const localAqi = aqiData ? sampleAqiNearest(aqiData, lng, lat) : null;
    
    let localTempK = null;
    try {
      if (tempData) {
        localTempK = sampleTempBilinear(tempData, lng, lat);
      }
    } catch (err) {
      console.error("Error interpolando temperatura en CPU:", err);
    }

    let displayVis = null;
    if (localVisRaw !== null) {
      const visKm = localVisRaw / 1000.0;
      displayVis = visKm > 24.0 ? '> 24.0' : visKm.toFixed(1);
    }

    const scalarMetrics = [];
    
    // 1. VIENTO
    if (isParticlesActive && particleFilters.wind && localWind) {
      let cWind = '#3333ff'; 
      if (localWind.speed >= 140) cWind = '#ffb6c1';
      else if (localWind.speed >= 120) cWind = '#ff00ff';
      else if (localWind.speed >= 100) cWind = '#8b0000';
      else if (localWind.speed >= 80) cWind = '#ff4500';
      else if (localWind.speed >= 70) cWind = '#ff8800';
      else if (localWind.speed >= 60) cWind = '#ffcc00';
      else if (localWind.speed >= 50) cWind = '#ffff00';
      else if (localWind.speed >= 40) cWind = '#adff2f';
      else if (localWind.speed >= 30) cWind = '#00ff00';
      else if (localWind.speed >= 20) cWind = '#2e8b57';
      else if (localWind.speed >= 10) cWind = '#4682b4';
      scalarMetrics.push({ label: 'Viento', value: localWind.speed.toFixed(1), unit: 'km/h', color: cWind });
    }

    // 2. LLUVIA
    if (isParticlesActive && particleFilters.rain && localRain !== null) {
      let cRain = 'rgba(0,255,255,0.3)'; // Sin/Poca lluvia
      if (localRain > 20) cRain = '#ff00ff'; // Magenta (Torrencial)
      else if (localRain > 10) cRain = '#800080'; // Púrpura
      else if (localRain > 2) cRain = '#0000ff'; // Azul puro
      else if (localRain > 0.1) cRain = '#00ffff'; // Celeste
      scalarMetrics.push({ label: 'Precipitación', value: localRain.toFixed(1), unit: 'mm', color: cRain });
    }

    // 3. NIEVE
    if (isParticlesActive && particleFilters.snow && localSnow !== null) {
      const getSnowColor = (val) => {
        if (val >= 150) return '#400c70';
        if (val >= 135) return '#2b4ea2';
        if (val >= 120) return '#136cb5';
        if (val >= 100) return '#1793d1';
        if (val >= 75) return '#1cb8e7';
        if (val >= 50) return '#3fd4f5';
        if (val >= 30) return '#72e3ff';
        if (val >= 15) return '#aeefff';
        if (val >= 5) return '#ddfbff';
        return '#ffffff';
      };
      
      scalarMetrics.push({ label: 'Nieve Acumulada', value: localSnow.accumulated.toFixed(1), unit: 'cm', color: getSnowColor(localSnow.accumulated) });
      scalarMetrics.push({ label: 'Nieve Fresca', value: localSnow.fresh.toFixed(1), unit: 'cm', color: getSnowColor(localSnow.fresh) });
    }

    // 4. VISIBILIDAD
    if (isParticlesActive && particleFilters.fog && displayVis !== null) {
      let cVis = 'rgba(255,255,255,0)'; // 20+ km
      const visNumber = parseFloat(displayVis);
      if (!isNaN(visNumber)) {
        if (visNumber < 1) cVis = '#8b4513';
        else if (visNumber < 2) cVis = '#d2691e';
        else if (visNumber < 5) cVis = '#f4a460';
        else if (visNumber < 10) cVis = '#f5deb3';
        else if (visNumber < 20) cVis = 'rgba(240,240,240,0.5)';
      }
      scalarMetrics.push({ label: 'Visibilidad', value: displayVis, unit: 'km', color: cVis });
    }

    // 5. TEMPERATURA
    if (isParticlesActive && particleFilters.temp && localTempK !== null && !isNaN(localTempK) && isFinite(localTempK)) {
      const baseTempC = localTempK - 273.15;
      let cTemp = '#00ffff'; 
      if (baseTempC >= 45) cTemp = '#800000'; // Burdeos
      else if (baseTempC >= 35) cTemp = '#ff0000'; // Rojo
      else if (baseTempC >= 25) cTemp = '#ff8800'; // Naranja
      else if (baseTempC >= 15) cTemp = '#ffff00'; // Amarillo
      else if (baseTempC >= 0) cTemp = '#00ff00'; // Verde
      else if (baseTempC >= -10) cTemp = '#4a0080'; // Morado oscuro
      else if (baseTempC >= -30) cTemp = '#9999ff'; // Azul hielo
      else cTemp = '#e6e6fa'; // Lavanda hielo
      
      const unitDef = METRICAS_UNIDADES['temperatura'].unidades.find(u => u.key === unidades['temperatura']) || METRICAS_UNIDADES['temperatura'].unidades[0];
      const formattedValue = unitDef.convertir(baseTempC).toFixed(unitDef.precision);
      scalarMetrics.push({ label: 'Temperatura', value: formattedValue, unit: unitDef.sufijo.trim(), color: cTemp });
    }

    const aqiActive = (isParticlesActive && particleFilters.aqi) || (isHeatmapActive && heatmapMetric === 'aqi');
    if (aqiActive && localAqi !== null) {
      let catLabel = 'Excelente';
      let catColor = '#e0f2ff';
      if (localAqi >= 300) { catLabel = 'Peligrosa'; catColor = '#7e0023'; }
      else if (localAqi >= 200) { catLabel = 'Muy Dañina'; catColor = '#8f3f97'; }
      else if (localAqi >= 150) { catLabel = 'Dañina'; catColor = '#ff0000'; }
      else if (localAqi >= 100) { catLabel = 'Dañina (Grupos Sensibles)'; catColor = '#ff7e00'; }
      else if (localAqi >= 50) { catLabel = 'Moderada'; catColor = '#ffff00'; }
      else if (localAqi >= 30) { catLabel = 'Buena'; catColor = '#00e400'; }
      else if (localAqi >= 10) { catLabel = 'Muy Buena'; catColor = '#7dd3ff'; }
      
      scalarMetrics.push({ label: 'Calidad del Aire (AQI)', value: Math.round(localAqi).toString(), unit: catLabel, color: catColor });
    }

    if (scalarMetrics.length > 0) {
      setScalarPopup({ lng, lat, metrics: scalarMetrics });
    } else {
      setScalarPopup(null);
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
        data: {
          ...nearest.city.data,
          windSpeed: localWind ? localWind.speed : nearest.city.data?.windSpeed,
          rain: localRain !== null ? localRain : nearest.city.data?.rain,
        },
      });
      try {
        const weather = await getWeatherAtLocation(lat, lng);
        if (weather?.current) {
          setWeatherCode(weather.current.weather_code);
          setSelectedCity(prev => {
            const updated = prev ? {
              ...prev,
              data: {
                ...prev.data,
                // Preservar viento y lluvia calculados localmente
                windSpeed: prev.data.windSpeed ?? weather.current.wind_speed_10m,
                rain: prev.data.rain ?? weather.current.rain,
              }
            } : null;
            return updated;
          });
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
      data: {
        temperatura: localTempK !== null ? localTempK - 273.15 : null, 
        aqi: localAqi !== null ? Math.round(localAqi) : null, 
        ica: null, ruido: null, humedad: null,
        windSpeed: localWind ? localWind.speed : null,
        rain: localRain !== null ? localRain : null,
      },
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
      };

      setWeatherCode(fullData?.weatherCode ?? null);
      
      setSelectedCity(prev => {
        const mergedWindSpeed = prev?.data?.windSpeed ?? fullData?.windSpeed ?? null;
        const mergedRain = prev?.data?.rain ?? fullData?.rain ?? null;
        
        const updated = {
          ...prev,
          name: placeName || 'Ubicación Desconocida',
          subtitle: `📡 Sensor IoT — Lat: ${lat.toFixed(3)}, Lng: ${lng.toFixed(3)}`,
          data: {
            ...prev?.data,
            ...newCityData,
            windSpeed: mergedWindSpeed,
            rain: mergedRain,
          },
          isLoading: false
        };
        
        return updated;
      });
      
    } catch (e) {
      console.error('Error al obtener datos:', e);
      setSelectedCity(prev => ({ 
        ...prev, 
        name: 'Error en conexión', 
        isLoading: false 
      }));
    }
  };

  // Contar cuántos controles están activos para el badge
  const activeControlsCount = [isParticlesActive, isHeatmapActive, isChoroplethActive, isHistoricalMode, showSensors, isSimMode].filter(Boolean).length;

  const handleCityClick = useCallback(async (city) => {
    setSelectedCity(city);
    try {
      const weather = await getWeatherAtLocation(city.latitude, city.longitude);
      if (weather?.current) {
        setWeatherCode(weather.current.weather_code);
        setSelectedCity(prev => prev ? {
          ...prev,
          data: { ...prev.data, windSpeed: weather.current.wind_speed_10m }
        } : null);
      }
    } catch (err) { console.error(err); }
  }, []);

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
      <ModalSensor
        isOpen={isSensorModalOpen}
        onClose={() => setIsSensorModalOpen(false)}
        initialCoordinates={sensorCoords}
        onSelectOnMap={() => {
          setIsSensorModalOpen(false);
          setIsSelectingSensorLocation(true);
        }}
        onSensorAdded={(newSensor) => {
          setRefreshTrigger(prev => prev + 1);
          setIsSensorModalOpen(false);
          if (newSensor?.latitude && newSensor?.longitude) {
            // Optimistic update: show the marker immediately without waiting for the fetch
            const optimisticSensor = {
              id: newSensor.id || `mqtt_pending_${Date.now()}`,
              name: newSensor.name,
              latitude: newSensor.latitude,
              longitude: newSensor.longitude,
              data: { temperatura: null, humedad: null, aqi: null, ica: null, ruido: null }
            };
            addSensorLocally(optimisticSensor);
            mapRef.current?.flyTo({
              center: [newSensor.longitude, newSensor.latitude],
              zoom: 10,
              duration: 1500
            });
            setSelectedCity(optimisticSensor);
          }
        }}
      />

      {isSelectingSensorLocation && (
        <div className="map-selection-banner-container">
          <div className="map-selection-banner">
            <span>📍 Haz clic en el mapa para establecer la ubicación del sensor</span>
            <button className="cancel-selection-btn" onClick={() => setIsSelectingSensorLocation(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
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

      <div className={`map-container${isSimMode ? ' sim-mode' : ''}${activeDrawingZone ? ' drawing-mode' : ''}`}>
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

            <MapLayers
              idPrefix="a"
              fronterasSeleccionadas={fronterasSeleccionadas}
              zonaSimZonas={zonaSimZonas}
              isSimMode={isSimMode}
              zonaSimActiva={zonaSimActiva}
              isHeatmapActive={isHeatmapActive}
              heatmapMetric={heatmapMetric}
              umbrales={umbrales}
              citiesData={citiesData}
              activeUmbralFilter={activeUmbralFilter}
              isChoroplethActive={isChoroplethActive}
              showSensors={showSensors}
              unidades={unidades}
              currentZoom={viewState.zoom}
              injectedCityId={injectedCityId}
              isParticlesActive={isParticlesActive}
              particleFilters={particleFilters}
              dynamicWindLabels={dynamicWindLabels}
              scannedGrid={isCompareMode ? scannedGridA.data : scannedGrid.data}
              onCityClick={handleCityClick}
            />

            {/* Dibujo Manual Zona 1 */}
            {zona1Cfg.selectionMode === 'manual' && zona1Cfg.manualPoints.length >= 2 && (
              <Source id="manual-z1-temp-src" type="geojson" data={getManualGeoJSON(zona1Cfg.manualPoints)}>
                {zona1Cfg.manualPoints.length < 3 ? (
                  <Layer
                    id="manual-z1-temp-line"
                    type="line"
                    paint={{ 'line-color': '#38bdf8', 'line-width': 2, 'line-dasharray': [2, 2] }}
                  />
                ) : (
                  <>
                    <Layer
                      id="manual-z1-temp-fill"
                      type="fill"
                      paint={{ 'fill-color': '#38bdf8', 'fill-opacity': 0.15 }}
                    />
                    <Layer
                      id="manual-z1-temp-line-closed"
                      type="line"
                      paint={{ 'line-color': '#38bdf8', 'line-width': 2 }}
                    />
                  </>
                )}
              </Source>
            )}
            {zona1Cfg.selectionMode === 'manual' && zona1Cfg.manualPoints.map((pt, idx) => (
              <Marker key={`z1-pt-${idx}`} longitude={pt[0]} latitude={pt[1]} anchor="center">
                <div className="manual-marker z1-marker">{idx + 1}</div>
              </Marker>
            ))}

            {/* Dibujo Manual Zona 2 */}
            {zona2Cfg.selectionMode === 'manual' && zona2Cfg.manualPoints.length >= 2 && (
              <Source id="manual-z2-temp-src" type="geojson" data={getManualGeoJSON(zona2Cfg.manualPoints)}>
                {zona2Cfg.manualPoints.length < 3 ? (
                  <Layer
                    id="manual-z2-temp-line"
                    type="line"
                    paint={{ 'line-color': '#a855f7', 'line-width': 2, 'line-dasharray': [2, 2] }}
                  />
                ) : (
                  <>
                    <Layer
                      id="manual-z2-temp-fill"
                      type="fill"
                      paint={{ 'fill-color': '#a855f7', 'fill-opacity': 0.15 }}
                    />
                    <Layer
                      id="manual-z2-temp-line-closed"
                      type="line"
                      paint={{ 'line-color': '#a855f7', 'line-width': 2 }}
                    />
                  </>
                )}
              </Source>
            )}
            {zona2Cfg.selectionMode === 'manual' && zona2Cfg.manualPoints.map((pt, idx) => (
              <Marker key={`z2-pt-${idx}`} longitude={pt[0]} latitude={pt[1]} anchor="center">
                <div className="manual-marker z2-marker">{idx + 1}</div>
              </Marker>
            ))}

            {scalarPopup && (
              <Popup
                longitude={scalarPopup.lng}
                latitude={scalarPopup.lat}
                closeButton={true}
                closeOnClick={false}
                onClose={() => setScalarPopup(null)}
                anchor="bottom"
                offset={15}
                className="premium-weather-popup"
              >
                <div style={{ background: 'rgba(20, 20, 20, 0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', padding: '8px', minWidth: '120px' }}>
                  {scalarPopup.metrics.map((m, idx) => (
                    <div key={idx} style={{ padding: '6px 4px', borderBottom: idx < scalarPopup.metrics.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', marginBottom: '2px' }}>{m.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {m.color && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: m.color, marginRight: '6px', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }}></div>}
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>{m.value}</span>
                        <span style={{ fontSize: '12px', color: '#ccc', marginLeft: '4px' }}>{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Popup>
            )}
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
                <MapLayers
                  idPrefix="b"
                  fronterasSeleccionadas={fronterasSeleccionadas}
                  zonaSimZonas={zonaSimZonas}
                  isSimMode={isSimMode}
                  zonaSimActiva={zonaSimActiva}
                  isHeatmapActive={isHeatmapActive}
                  heatmapMetric={heatmapMetric}
                  umbrales={umbrales}
                  citiesData={citiesData}
                  activeUmbralFilter={activeUmbralFilter}
                  isChoroplethActive={isChoroplethActive}
                  showSensors={showSensors}
                  unidades={unidades}
                  currentZoom={viewState.zoom}
                  injectedCityId={injectedCityId}
                  isParticlesActive={isParticlesActive}
                  particleFilters={particleFilters}
                  dynamicWindLabels={dynamicWindLabels}
                  scannedGrid={scannedGridB.data}
                  onCityClick={handleCityClick}
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
          setIsSensorModalOpen={setIsSensorModalOpen}
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
          {/* Timeline original comentado temporalmente (Fase 1 Reproductor)
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
          /> */}
          <TimePlayer 
            globalHistoryArray={globalHistoryArray}
            currentIndex={globalTimelineIndex}
            onIndexChange={setGlobalTimelineIndex}
            isDynamicHistoricalMode={isDynamicHistoricalMode}
            setCorruptedDates={setCorruptedDates}
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
        <>
          {/* Timeline original comentado temporalmente (Fase 1 Reproductor)
          <Timeline
            cityHistoryArray={cityHistoryArray}
            currentIndex={timelineIndex}
            onIndexChange={(idx) => setTimelineIndex(idx)}
          /> */}
          <TimePlayer 
            globalHistoryArray={cityHistoryArray}
            currentIndex={timelineIndex}
            onIndexChange={(idx) => setTimelineIndex(idx)}
            isDynamicHistoricalMode={false}
          />
        </>
      )}

      <SimulationStatus
        zonaSimActiva={zonaSimActiva}
        zonaSimZonas={zonaSimZonas}
        zonaSimUnidad={zonaSimUnidad}
        zonaSimEscNombre={zonaSimEscNombre}
        zonaSimMetrica={zonaSimMetrica}
        zonaSimProgreso={zonaSimProgreso}
        zonaSimTiempo={zonaSimTiempo}
        zonaSimSesionId={zonaSimSesionId}
        zonaSimTotalLecturas={zonaSimTotalLecturas}
        detenerZona={detenerZona}
      />
    </div>
  );
}

export default MapaMonitoreo;
