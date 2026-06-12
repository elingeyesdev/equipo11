import { useState } from 'react';
import { useMapVisuals } from '../../context/MapVisualsContext.jsx';

export default function ControlPanel({
  activeControlsCount,
  setIsInjectModalOpen,
  isSimMode, handleToggleSimMode,
  isParticlesActive, setIsParticlesActive,
  isHeatmapActive, setIsHeatmapActive, heatmapMetric, setHeatmapMetric,
  isChoroplethActive, setIsChoroplethActive,
  isHistoricalMode, setIsHistoricalMode,
  showSensors, setShowSensors, setSelectedCity,
  iotLoading,
  unidades, cambiarUnidad, METRICAS_UNIDADES,
  isDynamicHistoricalMode, setIsDynamicHistoricalMode,
  isCompareMode, setIsCompareMode,
  compareIndexA, compareIndexB, setCompareIndexA, setCompareIndexB,
  globalTimelineIndex, globalHistoryArray,
  particleFilters, setParticleFilters,
}) {
  const { snowMapType, setSnowMapType } = useMapVisuals();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('capas');

  return (
    <div className="map-controls-toolbar">
      <button
        className="controls-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Ajustes del mapa"
      >
        <span className={`controls-toggle-icon ${isOpen ? 'open' : ''}`}>⚙️</span>
        {activeControlsCount > 0 && !isOpen && (
          <span className="control-status-badge">{activeControlsCount}</span>
        )}
      </button>

      <button
        className="controls-toggle-btn"
        style={{ marginLeft: '10px' }}
        onClick={() => setIsInjectModalOpen(true)}
        title="Inyectar datos manualmente"
      >
        <span className="controls-toggle-icon">💉</span>
      </button>

      {isOpen && (
        <div className="controls-dropdown">
          <div className="controls-tabs">
            <button
              className={`controls-tab ${activeTab === 'capas' ? 'active' : ''}`}
              onClick={() => setActiveTab('capas')}
            >
              Capas
            </button>
            <button
              className={`controls-tab ${activeTab === 'preferencias' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferencias')}
            >
              Preferencias
            </button>
          </div>

          {activeTab === 'capas' ? (
            <div className="controls-tab-content">
              <div className="controls-section-title">Capas Visuales</div>

              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">🔬</span>
                  <span className="control-text">Modo Simulación</span>
                  {isSimMode && <span className="control-status on">ON</span>}
                </div>
                <label className="ios-switch">
                  <input type="checkbox" checked={isSimMode} onChange={(e) => handleToggleSimMode(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="controls-divider"></div>

              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">📡</span>
                  <span className="control-text">Sensores IoT</span>
                  {iotLoading && <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: 4 }}>cargando…</span>}
                </div>
                <label className="ios-switch">
                  <input type="checkbox" checked={showSensors} onChange={(e) => setShowSensors(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">🗺️</span>
                  <span className="control-text">Mapa de calor</span>
                </div>
                <label className="ios-switch">
                  <input type="checkbox" checked={isHeatmapActive} onChange={(e) => {
                    setIsHeatmapActive(e.target.checked);
                    if (e.target.checked) { setSelectedCity(null); setShowSensors(true); }
                  }} />
                  <span className="slider round"></span>
                </label>
              </div>

              {isHeatmapActive && (
                <div className="heatmap-expanded-section">
                  <div className="heatmap-metric-label">Métrica activa</div>
                  <select className="heatmap-metric-select" value={heatmapMetric} onChange={(e) => setHeatmapMetric(e.target.value)}>
                    <option value="aqi">Calidad de Aire (AQI)</option>
                    <option value="ica">Calidad del Agua (ICA)</option>
                    <option value="temperatura">Temperatura</option>
                    <option value="ruido">Nivel de Ruido</option>
                    <option value="humedad">Humedad</option>
                  </select>
                </div>
              )}


              <div className="controls-divider"></div>
            </div>
          ) : activeTab === 'preferencias' ? (
            <div className="controls-tab-content">
              <div className="controls-section-title">Preferencias de Usuario</div>
              <div className="units-content-dropdown">
                {Object.entries(METRICAS_UNIDADES).map(([key, cfg]) => (
                  <div key={key} className="units-row-dropdown">
                    <span className="units-icon">{cfg.icon}</span>
                    <span className="units-label">{key === 'aqi' ? 'Aire' : key === 'ica' ? 'Agua' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                    {cfg.unidades.length > 1 ? (
                      <select className="units-select-mini" value={unidades[key]} onChange={e => cambiarUnidad(key, e.target.value)}>
                        {cfg.unidades.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
                      </select>
                    ) : (
                      <span className="units-fixed-mini">{cfg.unidades[0].label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'clima_dinamico' ? (
            <div className="controls-tab-content">
              <div className="controls-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveTab('capas')}>
                <span style={{ fontSize: '1.2rem', color: 'var(--sage)' }}>‹</span>
                Volver a Capas
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
