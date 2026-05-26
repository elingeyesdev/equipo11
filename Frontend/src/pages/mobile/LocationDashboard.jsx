import { useState, useEffect } from 'react';
import httpClient from '../../config/httpClient';
import './LocationDashboard.css';

export default function LocationDashboard() {
  const [sensores, setSensores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await httpClient.get('/sensores');
        const items = Array.isArray(data) ? data : (data?.data || []);
        setSensores(items);
      } catch (err) {
        console.error('[Mobile] Error fetching sensores:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="mobile-page">
        <div className="mobile-loading">Cargando datos...</div>
      </div>
    );
  }

  // Agrupar promedios por métrica
  const metricas = ['temperatura', 'aqi', 'humedad', 'ruido'];
  const promedios = {};
  for (const m of metricas) {
    const valores = sensores.map(s => Number(s[m])).filter(v => !isNaN(v) && v > 0);
    promedios[m] = valores.length
      ? (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1)
      : '--';
  }

  const cards = [
    { key: 'temperatura', label: 'Temperatura', valor: promedios.temperatura, unidad: '°C', emoji: '🌡️', accent: 'var(--rust)' },
    { key: 'aqi', label: 'Calidad del Aire', valor: promedios.aqi, unidad: 'AQI', emoji: '🌿', accent: 'var(--moss)' },
    { key: 'humedad', label: 'Humedad', valor: promedios.humedad, unidad: '%', emoji: '💧', accent: 'var(--river)' },
    { key: 'ruido', label: 'Ruido', valor: promedios.ruido, unidad: 'dB', emoji: '🔊', accent: 'var(--amber)' },
  ];

  return (
    <div className="mobile-page">
      <header className="mobile-page-header">
        <span className="mobile-eyebrow">Monitoreo en vivo</span>
        <h1 className="mobile-page-title">EnviroSense</h1>
        <p className="mobile-page-subtitle">
          {sensores.length} estaciones activas
        </p>
      </header>

      <div className="mobile-cards-grid">
        {cards.map(c => (
          <div key={c.key} className="mobile-metric-card" style={{ '--card-accent': c.accent }}>
            <span className="mobile-metric-emoji">{c.emoji}</span>
            <div className="mobile-metric-info">
              <span className="mobile-metric-label">{c.label}</span>
              <span className="mobile-metric-value">
                {c.valor}<small>{c.unidad}</small>
              </span>
            </div>
          </div>
        ))}
      </div>

      <section className="mobile-stations-section">
        <h2 className="mobile-section-title">Estaciones Recientes</h2>
        <div className="mobile-stations-list">
          {sensores.slice(0, 6).map(s => (
            <div key={s.sensor_id || s.nombre} className="mobile-station-row">
              <div className="mobile-station-name">{s.nombre}</div>
              <div className="mobile-station-temp">
                {s.temperatura ? `${Number(s.temperatura).toFixed(1)}°C` : '--'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
