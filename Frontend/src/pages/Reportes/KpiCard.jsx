export default function KpiCard({ label, sufijo, colorVar, icon, stats }) {
  const { avg, min, max } = stats;
  return (
    <div className="rep-kpi">
      <div className="rep-kpi-head">
        {icon && (
          <span className="rep-kpi-icon" style={{
            background: `var(--${colorVar}-soft)`,
            color: `var(--${colorVar})`,
          }}>{icon}</span>
        )}
        <span className="rep-kpi-label">{label}</span>
      </div>
      <div className="rep-kpi-value">
        {avg != null ? `${avg.toFixed(1)}${sufijo}` : '—'}
      </div>
      {min != null && (
        <div className="rep-kpi-range">
          <span>mín {min.toFixed(1)}</span>
          <span>máx {max.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
