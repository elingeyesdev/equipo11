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
import Map, { NavigationControl, FullscreenControl, GeolocateControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMonitoreo.css';
import { useSimulacion } from '../../context/SimulacionContext';
import { useZonaSim } from '../../context/ZonaSimContext';
import { useMapVisuals } from '../../context/MapVisualsContext';
import { useTheme } from '../../context/ThemeContext';
import ModalSimulacion from '../../components/ModalSimulacion/ModalSimulacion';
import ModalInyeccion from '../../components/ModalInyeccion/ModalInyeccion';
import Timeline from '../../components/Timeline/Timeline';
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
import { buildGridIndex, sampleWindBilinear, buildRainGridIndex, sampleRainBilinear } from '../../utils/windMath';

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
    isFetchingRadar
  } = useRadarData({ isParticlesActive, isCompareMode, compareIndexA, compareIndexB, isDynamicHistoricalMode });

  const { iotSensors, iotLoading, dynamicWindLabels, citiesData } = useSensors({ scannedGrid, simulatedCities, isParticlesActive, particleFilters });

  const mapDebounceRef = useRef(null);
  const mapRef = useRef(null);
  const pendingFlyTo = useRef(null); // flyTo pendiente si el mapa aún no cargó
  const containerRef = useRef(null); // ref para el ResizeObserver

  // --- Índice vectorial del grid (U,V) para interpolación local del viento ---
  // Se recalcula solo cuando cambian los datos de la NOAA (scannedGrid)
  const windGridIndex = useMemo(() => {
    if (!scannedGrid?.data || scannedGrid.data.length === 0) return null;
    return buildGridIndex(scannedGrid.data);
  }, [scannedGrid]);

  const rainGridIndex = useMemo(() => {
    if (!scannedGrid?.data || scannedGrid.data.length === 0) return null;
    return buildRainGridIndex(scannedGrid.data);
  }, [scannedGrid]);

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

      // Interpolar viento y lluvia vectorialmente/escalar desde el grid (instantáneo)
      const localWind = windGridIndex ? sampleWindBilinear(windGridIndex, lng, lat) : null;
      const localRain = rainGridIndex ? sampleRainBilinear(rainGridIndex, lng, lat) : null;

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
    // Interpolar de forma instantánea (sin esperar API)
    const localWind = windGridIndex ? sampleWindBilinear(windGridIndex, lng, lat) : null;
    const localRain = rainGridIndex ? sampleRainBilinear(rainGridIndex, lng, lat) : null;

    const clickCity = {
      id: `click_${Date.now()}`,
      name: 'Buscando zona...',
      subtitle: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
      latitude: lat,
      longitude: lng,
      data: {
        temperatura: null, aqi: null, ica: null, ruido: null, humedad: null,
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
