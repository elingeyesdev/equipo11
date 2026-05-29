import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map, { GeolocateControl, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MobileMapView.css';
import { useTheme } from '../../context/ThemeContext';
import { useSimulacion } from '../../context/SimulacionContext';
import { useUmbrales } from '../../hooks/useUmbrales';
import useSensors from '../../hooks/useSensors';
import { useUnidades } from '../../hooks/useUnidades';
import { convertirValor } from '../../utils/unidades';

// Importar capas existentes
import MarkersLayer from '../MapaMonitoreo/layers/MarkersLayer';
import VoronoiLayer from '../MapaMonitoreo/layers/VoronoiLayer';
import ChoroplethLayer from '../MapaMonitoreo/layers/ChoroplethLayer';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const METRICAS = [
  { key: 'aqi', label: 'Aire (AQI)', icon: '💨' },
  { key: 'temperatura', label: 'Temperatura', icon: '🌡️' },
  { key: 'humedad', label: 'Humedad', icon: '💧' },
  { key: 'ica', label: 'Agua (ICA)', icon: '🌊' },
  { key: 'ruido', label: 'Ruido', icon: '🔊' }
];

export default function MobileMapView() {
  const { theme, toggleTheme } = useTheme();
  const { cities: simulatedCities } = useSimulacion();
  const { unidades } = useUnidades();

  // Estados de visualización del mapa
  const [activeLayer, setActiveLayer] = useState('heatmap'); // 'heatmap' | 'choropleth' | 'none'
  const [heatmapMetric, setHeatmapMetric] = useState('aqi');
  const [showSensors, setShowSensors] = useState(true);

  // Estados del Buscador / Geocoder
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Estados de selección de estación / ciudad
  const [selectedCity, setSelectedCity] = useState(null);
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Umbrales dinámicos para la métrica activa
  const { umbrales } = useUmbrales(heatmapMetric);

  // Cargar sensores y datos unificados
  const { citiesData } = useSensors({
    scannedGrid: null,
    simulatedCities: simulatedCities || [],
    isParticlesActive: false,
    particleFilters: {}
  });

  // Vista inicial centrada en Bolivia / Sudamérica central
  const [viewState, setViewState] = useState({
    longitude: -64.0,
    latitude: -17.0,
    zoom: 4.5
  });

  // Modo oscuro automático para Mapbox
  const mapStyle = theme === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11';

  // Manejo de clic fuera del buscador
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lógica del Buscador / Geocoding
  const handleSearch = (query) => {
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
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=es&country=bo,ar,br,py,pe,cl,uy`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults(data.features || []);
        setShowResults(true);
      } catch (err) {
        console.error('[MobileMap] Error en geocoder:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectResult = (result) => {
    setSearchQuery(result.text || result.place_name);
    setShowResults(false);

    if (result.geometry?.coordinates && mapRef.current) {
      const [lng, lat] = result.geometry.coordinates;
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 7.5,
        duration: 2000
      });
    }
  };

  const handleCityClick = useCallback((city) => {
    setSelectedCity(city);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [city.longitude, city.latitude],
        zoom: 6.5,
        duration: 1500
      });
    }
  }, []);

  const getMetricDetails = (city, metricKey) => {
    const rawVal = city?.data?.[metricKey] ?? city?.[metricKey];
    if (rawVal == null) return { formatted: '--', severidad: 'normal', label: 'Sin datos', color: '#888' };

    const val = Number(rawVal);
    const unit = unidades[metricKey];
    const converted = convertirValor(metricKey, val, unit);
    const formatted = `${Math.round(converted)} ${unit}`;

    // Obtener umbral/severidad si coincide con la métrica activa, si no estimar genérico
    let color = '#38bdf8';
    let label = 'Normal';
    let severidad = 'normal';

    if (umbrales && metricKey === heatmapMetric) {
      // Usar umbral real cargado
      const matched = umbrales.find(u => val >= u.valor_min && val <= u.valor_max);
      if (matched) {
        color = matched.color_hex;
        label = matched.label;
        severidad = matched.severidad;
      }
    } else {
      // Estimar colores base para dar excelente estética visual
      if (metricKey === 'temperatura') {
        if (val > 35) { color = '#f43f5e'; label = 'Crítica'; severidad = 'critica'; }
        else if (val > 28) { color = '#fb923c'; label = 'Advertencia'; severidad = 'advertencia'; }
      } else if (metricKey === 'aqi') {
        if (val > 150) { color = '#f43f5e'; label = 'Crítica'; severidad = 'critica'; }
        else if (val > 100) { color = '#fb923c'; label = 'Advertencia'; severidad = 'advertencia'; }
      }
    }

    return { formatted, val, color, label, severidad };
  };

  return (
    <div className="mobile-map-view">
      {/* ─── MAPA PRINCIPAL ─── */}
      <div className="mobile-map-container">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle={mapStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
          projection="mercator"
          maxZoom={9}
          minZoom={2.5}
          dragRotate={false}
          style={{ width: '100%', height: '100%' }}
        >
          <GeolocateControl position="bottom-right" />
          <NavigationControl position="bottom-right" showCompass={false} />

          {/* Capas interactivas */}
          {activeLayer === 'heatmap' && (
            <VoronoiLayer
              metrica={heatmapMetric}
              umbrales={umbrales}
              cities={citiesData}
              activeFilter={null}
            />
          )}

          {activeLayer === 'choropleth' && (
            <ChoroplethLayer
              metrica={heatmapMetric}
              umbrales={umbrales}
              cities={citiesData}
              activeFilter={null}
            />
          )}

          {showSensors && (
            <MarkersLayer
              cities={citiesData}
              metrica={heatmapMetric}
              umbrales={umbrales}
              activeFilter={null}
              unidad={unidades[heatmapMetric]}
              currentZoom={viewState.zoom}
              onCityClick={handleCityClick}
            />
          )}
        </Map>
      </div>

      {/* ─── TOOLBAR SUPERIOR CON GEOLOCATOR/BUSCADOR ─── */}
      <div className="mobile-map-header" ref={searchRef}>
        <div className="mobile-search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar ciudad o región..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}>
              ×
            </button>
          )}
          <button 
            className={`map-theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`}
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {showResults && (
          <ul className="search-results-overlay">
            {isSearching && <li className="search-loading">Buscando en mapa...</li>}
            {!isSearching && searchResults.length === 0 && (
              <li className="search-no-results">Sin coincidencias</li>
            )}
            {!isSearching && searchResults.map((result) => (
              <li key={result.id} className="search-item" onClick={() => handleSelectResult(result)}>
                <span className="search-item-icon">📍</span>
                <div className="search-item-text">
                  <span className="search-item-title">{result.text}</span>
                  <span className="search-item-subtitle">{result.place_name?.replace(`${result.text}, `, '')}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── BOTÓN FLOTANTE DE AJUSTES DEL MAPA ─── */}
      <button 
        className="mobile-floating-btn"
        onClick={() => setIsControlsOpen(true)}
        style={{ display: isControlsOpen ? 'none' : 'flex' }}
      >
        <span>⚙️ Capas y Métricas</span>
      </button>

      {/* ─── BANDEJA FLOTANTE DE AJUSTES / CONFIGURACIÓN DEL MAPA ─── */}
      <div className={`mobile-map-controls-panel ${isControlsOpen ? 'is-open' : ''}`}>
        <div className="panel-header">
          <h3>Ajustes del Mapa</h3>
          <button className="panel-close-btn" onClick={() => setIsControlsOpen(false)}>×</button>
        </div>

        {/* 1. Selector de Capas */}
        <div className="control-group">
          <label className="group-label">Tipo de Visualización</label>
          <div className="mobile-segmented-control">
            <button 
              className={activeLayer === 'heatmap' ? 'active' : ''} 
              onClick={() => setActiveLayer('heatmap')}
            >
              🔥 Mapa de Calor
            </button>
            <button 
              className={activeLayer === 'choropleth' ? 'active' : ''} 
              onClick={() => setActiveLayer('choropleth')}
            >
              🗺️ Coropletas
            </button>
            <button 
              className={activeLayer === 'none' ? 'active' : ''} 
              onClick={() => setActiveLayer('none')}
            >
              Base
            </button>
          </div>
        </div>

        {/* 2. Interruptor de Sensores */}
        <div className="control-group row-group">
          <span className="group-label">Mostrar Sensores (Valores)</span>
          <label className="push-switch">
            <input 
              type="checkbox" 
              checked={showSensors} 
              onChange={(e) => setShowSensors(e.target.checked)} 
            />
            <span className="push-slider"></span>
          </label>
        </div>

        {/* 3. Selector de Métrica Activa */}
        <div className="control-group">
          <label className="group-label">Métrica de Representación</label>
          <div className="metrics-pill-selector">
            {METRICAS.map(m => (
              <button 
                key={m.key} 
                className={`metric-pill ${heatmapMetric === m.key ? 'active' : ''}`}
                onClick={() => setHeatmapMetric(m.key)}
              >
                <span className="metric-pill-icon">{m.icon}</span>
                <span className="metric-pill-label">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── BANDEJA INFERIOR DE DETALLE DE LA CIUDAD SELECCIONADA ─── */}
      {selectedCity && (
        <div className="mobile-city-drawer">
          <div className="drawer-notch-wrapper" onClick={() => setSelectedCity(null)}>
            <div className="drawer-notch"></div>
          </div>

          <div className="drawer-header">
            <div>
              <span className="drawer-eyebrow">Detalles del Punto</span>
              <h2>{selectedCity.name || selectedCity.ciudad}</h2>
            </div>
            <button className="drawer-close" onClick={() => setSelectedCity(null)}>×</button>
          </div>

          {/* Mapeo del Estado actual de las 5 métricas */}
          <div className="drawer-metrics-grid">
            {METRICAS.map((m) => {
              const details = getMetricDetails(selectedCity, m.key);
              const isActive = m.key === heatmapMetric;
              return (
                <div 
                  key={m.key} 
                  className={`drawer-metric-card ${isActive ? 'is-active' : ''}`}
                  style={isActive ? { borderColor: details.color } : {}}
                >
                  <div className="card-top">
                    <span className="card-icon">{m.icon}</span>
                    <span className="card-title">{m.label}</span>
                  </div>
                  <div className="card-body">
                    <span className="card-value">{details.formatted}</span>
                    <span 
                      className="card-severity-badge"
                      style={{ background: details.color }}
                    >
                      {details.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
