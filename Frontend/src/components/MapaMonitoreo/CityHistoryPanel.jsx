import Draggable from '../Draggable/Draggable';
import './CityHistoryPanel.css';

function CityHistoryPanel({
  activeCity,
  setSelectedCity,
  isRunning,
  unidades,
  formatearValor,
  getDynamicColor,
  isComparingCities,
  setIsComparingCities,
  compareCity,
  setCompareCity
}) {
  if (!activeCity) return null;

  const handleClose = () => {
    setSelectedCity(null);
    if (setCompareCity) setCompareCity(null);
    if (setIsComparingCities) setIsComparingCities(false);
  };

  return (
    <Draggable className={`city-info-panel-wrapper ${isComparingCities ? 'comparing-mode' : ''}`}>
      <div className={`city-info-panel ${isComparingCities ? 'comparing-mode' : ''}`}>
        <button className="close-panel-btn" onClick={handleClose} aria-label="Cerrar panel">×</button>
        
        <div className="panel-header">
          {!isComparingCities ? (
            <>
              {activeCity.isLoading
                ? <div className="panel-skeleton-title" />
                : <h3>{activeCity.name}</h3>
              }
              <p className="panel-subtitle">
                {activeCity.isLoading
                  ? 'Consultando datos...'
                  : activeCity.es_custom
                    ? <><span className="panel-source-badge" style={{ backgroundColor: 'rgba(91, 192, 190, 0.2)', color: '#5bc0be', border: '1px solid rgba(91, 192, 190, 0.3)' }}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ display: 'inline', marginRight: '4px' }}><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.58 16.14a6 6 0 0 1 6.84 0" /><circle cx="12" cy="20" r="1" /></svg> MQTT Custom</span> HiveMQ Cloud</>
                    : activeCity.subtitle
                      ? <><span className="panel-source-badge"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 12a10 10 0 0 1 17-10"/><path d="M9 12a3 3 0 0 1 4-2"/><path d="M6 12a6 6 0 0 1 10-5"/><circle cx="12" cy="12" r="2"/></svg> API</span> {activeCity.subtitle}</>
                      : isRunning
                        ? <><span className="panel-source-badge sim"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg> Simulado</span> Tiempo real</>
                        : 'Datos estáticos'
                }
              </p>
            </>
          ) : (
            <div className="compare-header">
              <div className="compare-header-row">
                <div className="compare-header-item item-left">
                  <h4 className="compare-city-name">{activeCity.name}</h4>
                </div>
                <div className="compare-vs">VS</div>
                <div className="compare-header-item item-right">
                  <h4 className="compare-city-name">
                    {compareCity ? compareCity.name : 'Seleccione destino...'}
                  </h4>
                </div>
              </div>
              {!compareCity && (
                <div className="compare-instructions animate-pulse">
                  Haz clic en otra ubicación o sensor para comparar...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Switch para activar/desactivar el modo comparar */}
        <div className="compare-toggle-container">
          <span className="compare-toggle-label">Comparar ubicación</span>
          <label className="compare-switch">
            <input 
              type="checkbox" 
              checked={isComparingCities} 
              onChange={(e) => {
                const val = e.target.checked;
                setIsComparingCities(val);
                if (!val && setCompareCity) {
                  setCompareCity(null);
                }
              }} 
            />
            <span className="compare-slider"></span>
          </label>
        </div>

        <div className="panel-body">
          {[
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M11.5 6.5v6"/></svg>, label: 'Temperatura', key: 'temperatura', unit: unidades.temperatura },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 14h16"/><path d="M4 10h16"/><path d="M4 18h16"/><path d="M4 6h16"/></svg>, label: 'Calidad del Aire', key: 'aqi', unit: unidades.aqi },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>, label: 'Calidad del Agua', key: 'ica', unit: unidades.ica },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>, label: 'Nivel de Ruido', key: 'ruido', unit: unidades.ruido },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>, label: 'Humedad', key: 'humedad', unit: unidades.humedad },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.59-6.59A2 2 0 1 1 19 12H2"/></svg>, label: 'Viento', key: 'windSpeed', unit: unidades.windSpeed },
          ].map(({ icon, label, key, unit }) => (
            <div key={key} className={`data-item ${isComparingCities ? 'compare-row' : ''}`}>
              {!isComparingCities ? (
                <>
                  <div className="data-icon">{icon}</div>
                  <div className="data-content">
                    <span className="data-label">{label}</span>
                    {activeCity.isLoading
                      ? <div className="panel-skeleton-value" />
                      : <span className="data-value" style={{ color: getDynamicColor(key, activeCity.data?.[key]), fontWeight: 'bold' }}>
                        {formatearValor(key, activeCity.data?.[key], unit)}
                      </span>
                    }
                  </div>
                </>
              ) : (
                <div className="compare-columns">
                  {/* Ciudad A */}
                  <div className="compare-col compare-col-left">
                    {activeCity.isLoading ? (
                      <div className="panel-skeleton-value small" />
                    ) : (
                      <span className="data-value" style={{ color: getDynamicColor(key, activeCity.data?.[key]), fontWeight: 'bold' }}>
                        {formatearValor(key, activeCity.data?.[key], unit)}
                      </span>
                    )}
                  </div>

                  {/* Icono + Métrica */}
                  <div className="compare-col compare-col-center">
                    <div className="data-icon compare-icon">{icon}</div>
                    <span className="data-label compare-label">{label}</span>
                  </div>

                  {/* Ciudad B */}
                  <div className="compare-col compare-col-right">
                    {!compareCity ? (
                      <span className="data-value compare-empty">—</span>
                    ) : compareCity.isLoading ? (
                      <div className="panel-skeleton-value small" />
                    ) : (
                      <span className="data-value" style={{ color: getDynamicColor(key, compareCity.data?.[key]), fontWeight: 'bold' }}>
                        {formatearValor(key, compareCity.data?.[key], unit)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Draggable>
  );
}

export default CityHistoryPanel;
