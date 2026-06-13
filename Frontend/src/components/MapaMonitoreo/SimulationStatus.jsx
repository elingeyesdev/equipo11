import { useState } from 'react';
import { formatDateTime } from '../../utils/formatters';

export default function SimulationStatus({
  zonaSimActiva, zonaSimZonas, zonaSimUnidad, zonaSimEscNombre,
  zonaSimMetrica, zonaSimProgreso, zonaSimTiempo,
  zonaSimSesionId, zonaSimTotalLecturas,
  detenerZona,
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!zonaSimActiva) return null;

  if (isMinimized) {
    const pulseColor = (zonaSimZonas && zonaSimZonas[0]?.color) || '#38bdf8';
    return (
      <div className="zona-sim-status-panel zona-sim-minimized" style={{ width: 'auto', padding: '8px 12px', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
        <div className="zona-sim-pulse">
          <span className="zona-sim-dot" style={{ background: pulseColor }} />
        </div>
        <span style={{ font: '600 11px sans-serif', color: '#fff', whiteSpace: 'nowrap' }}>
          Simulación en curso: <strong>{zonaSimProgreso}%</strong>
        </span>
        <button 
          className="zona-sim-close-btn" 
          style={{ padding: '2px 6px', fontSize: '10px' }} 
          onClick={() => setIsMinimized(false)}
          title="Maximizar panel"
        >
          <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    );
  }

  const isComparison = zonaSimZonas && zonaSimZonas.length > 1;
  const firstZone = (zonaSimZonas && zonaSimZonas[0]) || {};
  const mainColor = firstZone.color || '#38bdf8';

  return (
    <div className="zona-sim-status-panel">
      <div className="zona-sim-header">
        <div className="zona-sim-pulse">
          <span className="zona-sim-dot" style={{ background: mainColor }} />
        </div>
        <span className="zona-sim-title">Simulación Activa</span>
        <button 
          className="zona-sim-close-btn" 
          style={{ marginRight: '4px' }}
          onClick={() => setIsMinimized(true)} 
          title="Minimizar panel"
        >
          −
        </button>
        <button className="zona-sim-close-btn" onClick={detenerZona} title="Detener simulación">⏹</button>
      </div>

      {!isComparison ? (
        // Modo frontera única
        <div className="zona-sim-valor-row">
          <div className="zona-sim-valor-big" style={{ color: mainColor }}>
            {firstZone.valor ?? '—'}
            <span className="zona-sim-unidad">{zonaSimUnidad}</span>
          </div>
          <div className="zona-sim-badge-wrap">
            <span className="zona-sim-severity-badge" style={{
              background: `${mainColor}22`, color: mainColor, borderColor: `${mainColor}55`
            }}>
              {firstZone.umbralLabel || '—'}
            </span>
          </div>
        </div>
      ) : (
        // Modo comparación (muestra las dos zonas)
        <div className="zona-sim-compare-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
          {zonaSimZonas.map((zona, idx) => {
            const zColor = zona.color || (idx === 0 ? '#38bdf8' : '#a855f7');
            return (
              <div 
                key={idx} 
                className="zona-sim-compare-card" 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderLeft: `4px solid ${zColor}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em' }}>
                  {zona.nombre}
                </div>
                <div className="zona-sim-valor-row" style={{ marginTop: '2px' }}>
                  <div className="zona-sim-valor-big" style={{ color: zColor, fontSize: '1.6rem' }}>
                    {zona.valor ?? '—'}
                    <span className="zona-sim-unidad" style={{ fontSize: '0.7rem' }}>{zonaSimUnidad}</span>
                  </div>
                  <div className="zona-sim-badge-wrap">
                    <span className="zona-sim-severity-badge" style={{
                      background: `${zColor}15`, color: zColor, borderColor: `${zColor}35`, fontSize: '9px', padding: '3px 8px', maxWidth: '120px'
                    }}>
                      {zona.umbralLabel || '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="zona-sim-info-row">
        <span className="zona-sim-info-label">Escenario</span>
        <span className="zona-sim-info-val">{zonaSimEscNombre || '—'}</span>
      </div>
      <div className="zona-sim-info-row">
        <span className="zona-sim-info-label">Métrica</span>
        <span className="zona-sim-info-val">{zonaSimMetrica} ({zonaSimUnidad})</span>
      </div>
      <div className="zona-sim-info-row">
        <span className="zona-sim-info-label">Fecha/Hora Sim</span>
        <span className="zona-sim-info-val">{formatDateTime(zonaSimTiempo)}</span>
      </div>

      <div className="zona-sim-progress-wrap">
        <div className="zona-sim-progress-label">
          <span>Progreso</span>
          <span>{zonaSimProgreso}%</span>
        </div>
        <div className="zona-sim-progress-bar">
          <div className="zona-sim-progress-fill" style={{
            width: `${zonaSimProgreso}%`, background: mainColor
          }} />
        </div>
      </div>

      {zonaSimSesionId && (
        <div className="zona-sim-db-badge">
          <span className="zona-sim-db-icon"><svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>
          <span>
            <strong>{zonaSimTotalLecturas}</strong> lecturas guardadas en BD
            &nbsp;·&nbsp; sesión #{zonaSimSesionId}
          </span>
        </div>
      )}
    </div>
  );
}
