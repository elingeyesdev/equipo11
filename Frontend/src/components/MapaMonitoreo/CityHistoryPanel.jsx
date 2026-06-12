import Draggable from '../Draggable/Draggable';
import './CityHistoryPanel.css';

function CityHistoryPanel({
  activeCity,
  setSelectedCity,
  isRunning,
  unidades,
  formatearValor,
  getDynamicColor
}) {
  if (!activeCity) return null;

  return (
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
                ? <><span className="panel-source-badge"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 12a10 10 0 0 1 17-10"/><path d="M9 12a3 3 0 0 1 4-2"/><path d="M6 12a6 6 0 0 1 10-5"/><circle cx="12" cy="12" r="2"/></svg> API</span> {activeCity.subtitle}</>
                : isRunning
                  ? <><span className="panel-source-badge sim"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></svg> Simulado</span> Tiempo real</>
                  : 'Datos estáticos'
            }
          </p>
        </div>
        <div className="panel-body">
          {[
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M11.5 6.5v6"/></svg>, label: 'Temperatura', key: 'temperatura', unit: unidades.temperatura },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 14h16"/><path d="M4 10h16"/><path d="M4 18h16"/><path d="M4 6h16"/></svg>, label: 'Calidad del Aire', key: 'aqi', unit: unidades.aqi },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>, label: 'Calidad del Agua', key: 'ica', unit: unidades.ica },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>, label: 'Nivel de Ruido', key: 'ruido', unit: unidades.ruido },
            { icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>, label: 'Humedad', key: 'humedad', unit: unidades.humedad },
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
  );
}

export default CityHistoryPanel;
