import { useState, useEffect } from 'react';
import httpClient from '../../config/httpClient';
import './AlertHistoryView.css';

export default function AlertHistoryView() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        const { data } = await httpClient.get('/alertas?limit=20&page=1');
        const items = data?.data?.rows || data?.rows || [];
        setAlertas(items);
      } catch (err) {
        console.error('[Mobile] Error fetching alertas:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlertas();
  }, []);

  if (loading) {
    return (
      <div className="mobile-page">
        <div className="mobile-loading">Cargando alertas...</div>
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <header className="mobile-page-header">
        <span className="mobile-eyebrow">Seguridad Ambiental</span>
        <h1 className="mobile-page-title">Alertas</h1>
        <p className="mobile-page-subtitle">{alertas.length} alertas recientes</p>
      </header>

      {alertas.length === 0 ? (
        <div className="mobile-placeholder-card">
          <span className="mobile-placeholder-icon">✅</span>
          <h3>Sin alertas</h3>
          <p>No hay alertas registradas. Todo se encuentra dentro de los parámetros normales.</p>
        </div>
      ) : (
        <div className="mobile-alerts-list">
          {alertas.map((a, i) => (
            <div key={a.id || i} className="mobile-alert-card" data-severity={a.severidad}>
              <div className="mobile-alert-top">
                <span
                  className="mobile-alert-badge"
                  style={{ background: a.color_hex || '#888' }}
                >
                  {a.severidad}
                </span>
                <time className="mobile-alert-time">
                  {new Date(a.tiempo).toLocaleString('es-BO', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </time>
              </div>
              <div className="mobile-alert-body">
                <strong>{a.ciudad}</strong> — {a.metrica_nombre || a.metrica}
              </div>
              <div className="mobile-alert-value">
                {Number(a.valor).toFixed(1)} {a.unidad || ''}
                <span className="mobile-alert-label">{a.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
