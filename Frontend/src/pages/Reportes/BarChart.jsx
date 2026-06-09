import { useMemo } from 'react';
import { formatCityName } from '../../utils/formatters';

export default function BarChart({ datos, metrica, colorVar }) {
  const cities = useMemo(() => {
    const map = {};
    datos.forEach(d => {
      const v = d[metrica];
      if (v == null || isNaN(v)) return;
      if (!map[d.ciudad]) map[d.ciudad] = { sum: 0, n: 0 };
      map[d.ciudad].sum += v;
      map[d.ciudad].n++;
    });
    return Object.entries(map)
      .map(([name, { sum, n }]) => ({ name: formatCityName(name), avg: sum / n }))
      .sort((a, b) => b.avg - a.avg);
  }, [datos, metrica]);

  if (!cities.length) return <div className="rep-chart-empty">Sin datos para comparar</div>;

  const H = 180;
  const PAD = { t: 20, r: 12, b: 50, l: 38 };
  const W = Math.max(560, cities.length * 40 + PAD.l + PAD.r);
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const maxV = Math.max(...cities.map(c => c.avg));
  const gap = cW / cities.length;
  const bW = Math.min(gap * 0.7, 30);
  const stroke = `var(--${colorVar})`;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: '8px', width: '100%' }} className="rep-chart-scrollable">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, height: H, display: 'block' }} aria-hidden="true">
        {[0, 0.5, 1].map((t, i) => {
          const y = PAD.t + cH * (1 - t);
          return (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray="3,3" strokeWidth={0.8} />
              <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="var(--ink-faint)">{(maxV * t).toFixed(0)}</text>
            </g>
          );
        })}
        {cities.map((c, i) => {
          const x = PAD.l + i * gap + gap / 2 - bW / 2;
          const bH = Math.max(2, (c.avg / maxV) * cH);
          const y = PAD.t + cH - bH;
          return (
            <g key={c.name}>
              <rect x={x} y={y} width={bW} height={bH} fill={stroke} fillOpacity={0.65} rx={3} />
              <text x={x + bW / 2 + 4} y={H - PAD.b + 16} textAnchor="end" fontSize={9} fill="var(--ink-mute)" transform={`rotate(-45, ${x + bW / 2 + 4}, ${H - PAD.b + 16})`}>
                {c.name.length > 15 ? c.name.slice(0, 13) + '…' : c.name}
              </text>
              <text x={x + bW / 2} y={y - 4} textAnchor="middle" fontSize={8} fill="var(--ink-mute)" fontWeight="600">
                {c.avg.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
