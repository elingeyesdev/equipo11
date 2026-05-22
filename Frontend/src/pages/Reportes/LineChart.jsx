import { useState, useMemo } from 'react';
import { formatDate, formatTime } from '../../utils/formatters';

export default function LineChart({ series, metrica }) {
  const [hoverData, setHoverData] = useState(null);

  const todasLasFechas = useMemo(() => {
    const s = new Set();
    series.forEach(serie => serie.datos.forEach(d => {
      if (d[metrica] != null && !isNaN(d[metrica])) {
        s.add(new Date(d.fecha).getTime());
      }
    }));
    return Array.from(s).sort((a, b) => a - b);
  }, [series, metrica]);

  if (todasLasFechas.length < 2) {
    return <div className="rep-chart-empty">Datos insuficientes para la serie temporal</div>;
  }

  const H = 200, PX = 45, PY = 30;
  const numPuntos = Math.max(...series.map(s => s.datos.length));
  const W = Math.max(560, numPuntos * 12 + PX * 2);

  const minT = todasLasFechas[0];
  const maxT = todasLasFechas[todasLasFechas.length - 1];
  const rangeT = maxT - minT || 1;

  let minV = Infinity, maxV = -Infinity;
  series.forEach(serie => {
    serie.datos.forEach(d => {
      const v = d[metrica];
      if (v != null && !isNaN(v)) {
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    });
  });
  if (minV === Infinity) minV = 0;
  if (maxV === -Infinity) maxV = 100;
  const extraV = (maxV - minV) * 0.15 || 5;
  minV = Math.floor(minV - extraV);
  maxV = Math.ceil(maxV + extraV);
  const rangeV = maxV - minV || 1;

  const cx = t => PX + ((t - minT) / rangeT) * (W - PX * 2);
  const cy = v => PY + ((maxV - v) / rangeV) * (H - PY - 25);

  const ticksY = [minV, minV + (maxV - minV) / 2, maxV];

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const t = minT + ((x - PX) / (W - PX * 2)) * rangeT;

    let closestT = todasLasFechas[0];
    let minDiff = Math.abs(t - closestT);
    for (let i = 1; i < todasLasFechas.length; i++) {
      const diff = Math.abs(t - todasLasFechas[i]);
      if (diff < minDiff) { minDiff = diff; closestT = todasLasFechas[i]; }
    }

    const points = series.map(s => {
      const d = s.datos.find(pt => new Date(pt.fecha).getTime() === closestT);
      return d ? { val: d[metrica], color: s.colorVar, name: s.name } : null;
    }).filter(Boolean);

    if (points.length) setHoverData({ t: closestT, points, x: cx(closestT) });
  };

  return (
    <div className="rep-chart-container">
      <div className="rep-chart-scrollable" style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: '12px', width: '100%', position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, height: H, display: 'block', cursor: 'crosshair' }} aria-hidden="true"
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverData(null)}>
          {ticksY.map((v, i) => {
            const y = cy(v);
            return (
              <g key={i}>
                <line x1={PX} x2={W - PX} y1={y} y2={y} stroke="var(--line)" strokeDasharray="4,4" strokeWidth={0.8} />
                <text x={PX - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-faint)" fontWeight="500">{v.toFixed(0)}</text>
              </g>
            );
          })}
          <text x={PX} y={H - 8} textAnchor="start" fontSize={10} fill="var(--ink-mute)" fontWeight="500">
            {formatDate(minT)} {formatTime(minT)}
          </text>
          <text x={W - PX} y={H - 8} textAnchor="end" fontSize={10} fill="var(--ink-mute)" fontWeight="500">
            {formatDate(maxT)} {formatTime(maxT)}
          </text>
          {series.map((serie, sIdx) => {
            let pts = serie.datos.filter(d => d[metrica] != null && !isNaN(d[metrica])).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            if (pts.length === 0) return null;
            const linePath = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${cx(new Date(d.fecha).getTime()).toFixed(1)},${cy(d[metrica]).toFixed(1)}`).join(' ');
            const stroke = `var(--${serie.colorVar})`;
            const areaPath = series.length === 1
              ? `${linePath} L${cx(new Date(pts[pts.length - 1].fecha).getTime()).toFixed(1)},${cy(minV).toFixed(1)} L${cx(new Date(pts[0].fecha).getTime()).toFixed(1)},${cy(minV).toFixed(1)} Z`
              : null;
            return (
              <g key={sIdx}>
                {areaPath && <path d={areaPath} fill={stroke} fillOpacity={0.1} />}
                <path d={linePath} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ transition: 'all 0.3s' }} />
                {pts.length <= 50 && pts.map((d, i) => (
                  <circle key={i} cx={cx(new Date(d.fecha).getTime())} cy={cy(d[metrica])} r={3.5} fill="var(--card)" stroke={stroke} strokeWidth={1.5} />
                ))}
              </g>
            );
          })}
          {hoverData && (
            <g>
              <line x1={hoverData.x} x2={hoverData.x} y1={PY} y2={cy(minV)} stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="2,2" />
              {hoverData.points.map((p, i) => (
                <circle key={i} cx={hoverData.x} cy={cy(p.val)} r={5} fill={`var(--${p.color})`} stroke="white" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hoverData && (
          <div className="rep-chart-tooltip" style={{ left: Math.min(hoverData.x, W - 150), top: 10 }}>
            <div className="rep-tooltip-date">
              {formatDate(hoverData.t)}<br />
              <span className="rep-tooltip-time">{formatTime(hoverData.t)}</span>
            </div>
            <div className="rep-tooltip-items">
              {hoverData.points.map((p, i) => (
                <div key={i} className="rep-tooltip-item">
                  <span className="rep-tooltip-dot" style={{ background: `var(--${p.color})` }}></span>
                  <span className="rep-tooltip-name">{p.name}:</span>
                  <span className="rep-tooltip-val">{p.val.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="rep-chart-legend">
        {series.map((s, i) => (
          <div key={i} className="rep-legend-item">
            <span className="rep-legend-dot" style={{ background: `var(--${s.colorVar})` }}></span>
            <span className="rep-legend-name">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
