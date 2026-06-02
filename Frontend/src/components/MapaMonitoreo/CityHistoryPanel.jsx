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
  );
}

export default CityHistoryPanel;
