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

              <div className="control-row" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('clima_dinamico')}>
                <div className="control-row-label">
                  <span className="control-icon">🌦️</span>
                  <span className="control-text">Mapas atmosféricos</span>
                </div>
                <span style={{ color: 'var(--sage)', opacity: 0.8, fontSize: '1.2rem', paddingRight: '5px' }}>›</span>
              </div>

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

              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">🗾</span>
                  <span className="control-text">Div. administrativas</span>
                </div>
                <label className="ios-switch">
                  <input type="checkbox" checked={isChoroplethActive} onChange={(e) => setIsChoroplethActive(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="controls-divider"></div>

              <div className="control-row">
                <div className="control-row-label">
                  <span className="control-icon">⏳</span>
                  <span className="control-text">Histórico</span>
                  <span className={`control-status ${isHistoricalMode ? 'on' : 'off'}`}>{isHistoricalMode ? 'ON' : 'OFF'}</span>
                </div>
                <label className="ios-switch">
                  <input type="checkbox" checked={isHistoricalMode} onChange={(e) => {
                    const val = e.target.checked;
                    setIsHistoricalMode(val);
                    if (val) setIsDynamicHistoricalMode(false);
                  }} />
                  <span className="slider round"></span>
                </label>
              </div>
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

              <div style={{ paddingLeft: '20px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { key: 'temp', label: 'Temperatura', icon: '🌡️' },
                  { key: 'rain', label: 'Lluvia / Tormentas', icon: '🌧️' },
                  { key: 'snow', label: 'Nieve', icon: '❄️' },
                  { key: 'fog', label: 'Visibilidad', icon: '🌫️' },
                  { key: 'wind', label: 'Viento / Tornados', icon: '🌪️' },
                  { key: 'aqi', label: 'Calidad del Aire (AQI)', icon: '😷' },
                ].map(f => (
                  <div key={f.key}>
                    <div className="control-row" style={{ minHeight: '30px' }}>
                      <div className="control-row-label" style={{ fontSize: '0.85rem' }}>
                        <span className="control-icon" style={{ fontSize: '1rem', width: '20px' }}>{f.icon}</span>
                        <span className="control-text">{f.label}</span>
                      </div>
                      <label className="ios-switch" style={{ transform: 'scale(0.75)' }}>
                        <input type="checkbox" checked={particleFilters[f.key] || false} onChange={(e) => {
                          const isChecked = e.target.checked;
                          if (!isParticlesActive && isChecked) setIsParticlesActive(true); // Activa el canvas principal
                          if (f.key === 'fog') console.log(`[DEBUG VISIBILITY] Toggle activado: ${isChecked}`);
                          setParticleFilters(prev => {
                            if (f.key === 'wind' && isChecked) return { rain: false, snow: false, fog: false, temp: false, aqi: false, wind: true };
                            else if (f.key !== 'wind' && isChecked) return { ...prev, wind: false, [f.key]: true };
                            return { ...prev, [f.key]: isChecked };
                          });
                        }} />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {f.key === 'snow' && particleFilters.snow && (
                      <div style={{ paddingLeft: '35px', display: 'flex', gap: '15px', fontSize: '0.8rem', marginTop: '2px', marginBottom: '8px', color: 'var(--text-color)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input type="radio" name="snowType" value="depth" checked={snowMapType === 'depth'} onChange={(e) => setSnowMapType(e.target.value)} /> Acumulada
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input type="radio" name="snowType" value="fresh" checked={snowMapType === 'fresh'} onChange={(e) => setSnowMapType(e.target.value)} /> Fresca (Tasa)
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="controls-divider"></div>

              <div className="control-row" style={{ opacity: isParticlesActive ? 1 : 0.5, pointerEvents: isParticlesActive ? 'auto' : 'none' }}>
                <div className="control-row-label">
                  <span className="control-icon">⏳</span>
                  <span className="control-text">Histórico de Clima</span>
                  <span className={`control-status ${isDynamicHistoricalMode ? 'on' : 'off'}`}>{isDynamicHistoricalMode ? 'ON' : 'OFF'}</span>
                </div>
                <label className="ios-switch">
                  <input type="checkbox" checked={isDynamicHistoricalMode} onChange={(e) => {
                    const val = e.target.checked;
                    setIsDynamicHistoricalMode(val);
                    if (val) { setIsHistoricalMode(false); if (isCompareMode && compareIndexA === null) setCompareIndexA(globalTimelineIndex); }
                  }} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="control-row" style={{ opacity: 1, pointerEvents: 'auto' }}>
                <div className="control-row-label">
                  <span className="control-icon">⚖️</span>
                  <span className="control-text">Modo Comparar</span>
                </div>
                <label className="ios-switch">
                  <input type="checkbox" checked={isCompareMode} onChange={(e) => {
                    const val = e.target.checked;
                    setIsCompareMode(val);
                    if (val) {
                      if (compareIndexA === null) setCompareIndexA(globalTimelineIndex);
                      if (compareIndexB === null) setCompareIndexB(Math.min(globalTimelineIndex + 1, globalHistoryArray.length - 1));
                    }
                  }} />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
