import { formatDateTime } from '../../utils/formatters';

export default function SimulationStatus({
  zonaSimActiva, zonaSimZonas, zonaSimUnidad, zonaSimEscNombre,
  zonaSimMetrica, zonaSimProgreso, zonaSimTiempo,
  zonaSimSesionId, zonaSimTotalLecturas,
  detenerZona,
}) {
  if (!zonaSimActiva) return null;

  const firstZone = (zonaSimZonas && zonaSimZonas[0]) || {};
  const color = firstZone.color || '#38bdf8';
  const valor = firstZone.valor ?? null;
  const umbralLabel = firstZone.umbralLabel || '—';

  return (
    <div className="zona-sim-status-panel">
      <div className="zona-sim-header">
        <div className="zona-sim-pulse">
          <span className="zona-sim-dot" style={{ background: color }} />
        </div>
        <span className="zona-sim-title">Simulación Activa</span>
        <button className="zona-sim-close-btn" onClick={detenerZona} title="Detener simulación">⏹</button>
      </div>

      <div className="zona-sim-valor-row">
        <div className="zona-sim-valor-big" style={{ color }}>
          {valor !== null ? valor : '—'}
          <span className="zona-sim-unidad">{zonaSimUnidad}</span>
        </div>
        <div className="zona-sim-badge-wrap">
          <span className="zona-sim-severity-badge" style={{
            background: `${color}22`, color, borderColor: `${color}55`
          }}>
            {umbralLabel}
          </span>
        </div>
      </div>

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
            width: `${zonaSimProgreso}%`, background: color
          }} />
        </div>
      </div>

      {zonaSimSesionId && (
        <div className="zona-sim-db-badge">
          <span className="zona-sim-db-icon">✓</span>
          <span>
            <strong>{zonaSimTotalLecturas}</strong> lecturas guardadas en BD
            &nbsp;·&nbsp; sesión #{zonaSimSesionId}
          </span>
        </div>
      )}
    </div>
  );
}
