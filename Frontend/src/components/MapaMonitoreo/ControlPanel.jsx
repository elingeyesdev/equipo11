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
        className="controls-toggle-btn bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center justify-center p-2 rounded-md transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Ajustes del mapa"
      >
        <span className={`controls-toggle-icon ${isOpen ? 'open' : ''}`}><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg></span>
        {activeControlsCount > 0 && !isOpen && (
          <span className="control-status-badge">{activeControlsCount}</span>
        )}
      </button>

      <button
        className="controls-toggle-btn bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center justify-center p-2 rounded-md transition-colors"
        style={{ marginLeft: '10px' }}
        onClick={() => setIsInjectModalOpen(true)}
        title="Inyectar datos manualmente"
      >
        <span className="controls-toggle-icon"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg></span>
      </button>

      {isOpen && (
        <div className="controls-dropdown bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] shadow-md rounded-md">
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
                  <span className="control-icon"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg></span>
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
                  <span className="control-icon"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 12a10 10 0 0 1 17-10"/><path d="M9 12a3 3 0 0 1 4-2"/><path d="M6 12a6 6 0 0 1 10-5"/><circle cx="12" cy="12" r="2"/></svg></span>
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
                  <span className="control-icon"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg></span>
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
