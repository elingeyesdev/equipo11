/**
 * ModalSimulacion — Nuevo modal de configuración de simulación por zona.
 *
 * Flujo:
 *   1. Usuario definió el área en el mapa → hace clic "Iniciar Simulación"
 *   2. Modal se abre mostrando 5 cards (una por métrica)
 *   3. En cada card: selección de escenario + configuración de parámetros
 *   4. Clic "Iniciar" → emite zona:iniciar por WebSocket
 *   5. Modal se cierra; la zona en el mapa cambia de color en tiempo real
 */
import { useState, useCallback, useMemo } from 'react';
import { useSimulacion } from '../../context/SimulacionContext';
import ESCENARIOS from './escenarios.frontend';
import './ModalSimulacion.css';

// ─── Opciones de configuración ───────────────────────────────────────────────
const OPCIONES_GUARDADO = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hora' },
];

const OPCIONES_SIM = [
  { value: 3,  label: '3 s' },
  { value: 5,  label: '5 s' },
  { value: 10, label: '10 s' },
];

// ─── Sparkline SVG inline ─────────────────────────────────────────────────────
function Sparkline({ inicio, fin, curva, color, width = 220, height = 44 }) {
  const points = useMemo(() => {
    const n = 30;
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      let p;
      if (curva === 'exponencial') p = t * t;
      else if (curva === 'pico') p = t <= 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
      else p = t;
      const v = inicio + (fin - inicio) * p;
      const x = (i / (n - 1)) * width;
      const range = Math.abs(fin - inicio) || 1;
      const normalMin = Math.min(inicio, fin);
      const y = height - ((v - normalMin) / range) * (height - 8) - 4;
      return `${x},${y}`;
    }).join(' ');
  }, [inicio, fin, curva, width, height]);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={color}
        fillOpacity="0.12"
        stroke="none"
      />
    </svg>
  );
}

// ─── Spinner numérico ─────────────────────────────────────────────────────────
function NumberSpinner({ value, min, max, onChange, unit }) {
  return (
    <div className="msim-spinner">
      <input
        type="number"
        className="msim-spinner-input"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      />
      <span className="msim-spinner-unit">{unit}</span>
      <div className="msim-spinner-arrows">
        <button
          className="msim-spinner-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label="Incrementar"
        >▲</button>
        <button
          className="msim-spinner-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label="Decrementar"
        >▼</button>
      </div>
    </div>
  );
}

// ─── Card de escenario (radio) ────────────────────────────────────────────────
function EscenarioCard({ escenario, selected, onSelect, metricaColor }) {
  return (
    <div
      className={`msim-escenario-card${selected ? ' msim-escenario-card--active' : ''}`}
      style={selected ? { borderColor: escenario.borderColor || metricaColor } : {}}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
    >
      <div
        className="msim-escenario-icon"
        style={{ background: escenario.iconBg }}
      >
        {escenario.icon}
      </div>
      <div className="msim-escenario-nombre">{escenario.nombre}</div>
      <div className="msim-escenario-desc">{escenario.descripcion}</div>
      <div
        className="msim-escenario-rango"
        style={{ background: `${escenario.borderColor}22`, color: escenario.borderColor }}
      >
        {escenario.rangoLabel}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
function ModalSimulacion({ isOpen, onClose, simPoints = [] }) {
  const { iniciarZona, detenerZona, zonaSimActiva } = useSimulacion();

  // Card activa (0–4)
  const [cardIdx, setCardIdx] = useState(0);

  // Config por card: { escenarioIdx, dias, intervalMin, intervalSimSeg }
  const [configs, setConfigs] = useState(() =>
    ESCENARIOS.map(e => ({
      escenarioIdx: 0,
      dias:          e.defaultDias,
      intervalMin:   e.defaultIntervalMin,
      intervalSimSeg: e.defaultIntervalSimSeg,
    }))
  );

  const [isLaunching, setIsLaunching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const card = ESCENARIOS[cardIdx];
  const cfg  = configs[cardIdx];

  const updateCfg = useCallback((key, value) => {
    setConfigs(prev => {
      const next = [...prev];
      next[cardIdx] = { ...next[cardIdx], [key]: value };
      return next;
    });
  }, [cardIdx]);

  // Calcular total de lecturas estimadas
  const totalLecturas = useMemo(() => {
    const totalMinutos = cfg.dias * 24 * 60;
    return Math.floor(totalMinutos / cfg.intervalMin) + 1;
  }, [cfg.dias, cfg.intervalMin]);

  const escenarioSeleccionado = card.escenarios[cfg.escenarioIdx];

  // Resumen para el footer
  const resumen = `Caso ${escenarioSeleccionado.nombre} · ${cfg.dias} día${cfg.dias !== 1 ? 's' : ''} · 1 lectura cada ${cfg.intervalMin} min · tick ${cfg.intervalSimSeg}s`;

  const handleIniciar = async () => {
    if (simPoints.length < 3) return;
    setIsLaunching(true);
    try {
      iniciarZona({
        metricaClave: card.metricaClave,
        escenario: escenarioSeleccionado,
        dias: cfg.dias,
        intervalMinutos: cfg.intervalMin,
        intervalSimSeg: cfg.intervalSimSeg,
        puntos: simPoints,
        nombreZona: `Zona ${card.nombre}`,
      });
      onClose();
    } finally {
      setIsLaunching(false);
    }
  };

  const handleDetener = () => {
    detenerZona();
  };

  if (!isOpen) return null;

  return (
    <div
      className="msim-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="msim-box">

        {/* ── Header ── */}
        <div className="msim-box-header">
          <span className="msim-box-title">Configurar Simulación</span>
          <button className="msim-close-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {/* ── Dots de navegación ── */}
        <div className="msim-dots">
          {ESCENARIOS.map((e, i) => (
            <button
              key={e.metricaClave}
              className={`msim-dot${i === cardIdx ? ' msim-dot--active' : ''}`}
              style={i === cardIdx ? { background: e.categoriaColor } : {}}
              onClick={() => setCardIdx(i)}
              title={e.nombre}
            />
          ))}
        </div>

        {/* ── Card de métrica ── */}
        <div className="msim-card">

          {/* Número + badge categoría */}
          <div className="msim-card-top">
            <span className="msim-card-num">{card.numero}</span>
            <span className="msim-card-num-label">DATO A SIMULAR</span>
            <div
              className="msim-badge"
              style={{ background: `${card.categoriaColor}22`, color: card.categoriaColor, borderColor: `${card.categoriaColor}44` }}
            >
              <span className="msim-badge-dot" style={{ background: card.categoriaColor }} />
              {card.categoria}
            </div>
          </div>

          {/* Título + descripción */}
          <h2 className="msim-metric-title">
            {card.nombre}
            {card.subtitulo && <em className="msim-metric-italic"> {card.subtitulo}</em>}
          </h2>
          <p className="msim-metric-desc">{card.descripcion}</p>

          {/* Escenarios */}
          <div className="msim-section-label">
            SELECCIONA UN ESCENARIO
            <span className="msim-section-hint">{card.escenarios.length} casos · radio</span>
          </div>
          <div className="msim-escenarios-grid">
            {card.escenarios.map((esc, idx) => (
              <EscenarioCard
                key={esc.id}
                escenario={esc}
                selected={cfg.escenarioIdx === idx}
                onSelect={() => updateCfg('escenarioIdx', idx)}
                metricaColor={card.categoriaColor}
              />
            ))}
          </div>

          {/* Preview sparkline */}
          {showPreview && (
            <div className="msim-preview-chart">
              <Sparkline
                inicio={escenarioSeleccionado.inicio}
                fin={escenarioSeleccionado.fin}
                curva={escenarioSeleccionado.curva}
                color={escenarioSeleccionado.borderColor}
                width={320}
                height={56}
              />
              <span className="msim-preview-label">
                {totalLecturas} lecturas · {escenarioSeleccionado.rangoLabel}
              </span>
            </div>
          )}

          {/* Controles */}
          <div className="msim-controls-row">
            <div className="msim-control-group">
              <label className="msim-ctrl-label">CANTIDAD DE DÍAS</label>
              <NumberSpinner
                value={cfg.dias}
                min={1}
                max={15}
                unit="días"
                onChange={v => updateCfg('dias', v)}
              />
              <span className="msim-ctrl-hint">Rango 1–15</span>
            </div>

            <div className="msim-control-group">
              <label className="msim-ctrl-label">INTERVALO GUARDADO</label>
              <div className="msim-spinner">
                <select
                  className="msim-select"
                  value={cfg.intervalMin}
                  onChange={e => updateCfg('intervalMin', Number(e.target.value))}
                >
                  {OPCIONES_GUARDADO.map(o => (
                    <option key={o.value} value={o.value}>{o.value}</option>
                  ))}
                </select>
                <span className="msim-spinner-unit">min</span>
              </div>
              <span className="msim-ctrl-hint">Frecuencia de escritura</span>
            </div>

            <div className="msim-control-group">
              <label className="msim-ctrl-label">INTERVALO SIMULACIÓN</label>
              <div className="msim-spinner">
                <select
                  className="msim-select"
                  value={cfg.intervalSimSeg}
                  onChange={e => updateCfg('intervalSimSeg', Number(e.target.value))}
                >
                  {OPCIONES_SIM.map(o => (
                    <option key={o.value} value={o.value}>{o.value}</option>
                  ))}
                </select>
                <span className="msim-spinner-unit">seg</span>
              </div>
              <span className="msim-ctrl-hint">Velocidad de tick</span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="msim-footer">
          <p className="msim-footer-resumen">{resumen}</p>
          <div className="msim-footer-actions">
            <button
              className="msim-btn msim-btn-preview"
              onClick={() => setShowPreview(v => !v)}
            >
              {showPreview ? 'Ocultar' : 'Vista previa'}
            </button>

            {zonaSimActiva ? (
              <button
                className="msim-btn msim-btn-stop"
                onClick={handleDetener}
              >
                ⏹ Detener
              </button>
            ) : (
              <button
                className="msim-btn msim-btn-start"
                onClick={handleIniciar}
                disabled={isLaunching || simPoints.length < 3}
                title={simPoints.length < 3 ? 'Necesitas al menos 3 puntos en el mapa' : ''}
              >
                {isLaunching ? 'Iniciando...' : 'Iniciar ▶'}
              </button>
            )}
          </div>
        </div>

        {/* ── Navegación entre cards ── */}
        <div className="msim-nav">
          <button
            className="msim-nav-btn"
            onClick={() => setCardIdx(i => Math.max(0, i - 1))}
            disabled={cardIdx === 0}
          >← Anterior</button>
          <span className="msim-nav-counter">{cardIdx + 1} / {ESCENARIOS.length}</span>
          <button
            className="msim-nav-btn"
            onClick={() => setCardIdx(i => Math.min(ESCENARIOS.length - 1, i + 1))}
            disabled={cardIdx === ESCENARIOS.length - 1}
          >Siguiente →</button>
        </div>

      </div>
    </div>
  );
}

export default ModalSimulacion;
