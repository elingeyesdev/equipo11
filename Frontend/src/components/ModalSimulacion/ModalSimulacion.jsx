/**
 * ModalSimulacion — Modal de configuración de simulación COMPARATIVA.
 * 
 * Permite configurar escenarios independientes para cada zona seleccionada.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSimulacion } from '../../context/SimulacionContext';
import ESCENARIOS from './escenarios.frontend';
import './ModalSimulacion.css';

const OPCIONES_GUARDADO = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hora' },
];

const OPCIONES_SIM = [
  { value: 1,  label: '1 s' },
  { value: 3,  label: '3 s' },
  { value: 5,  label: '5 s' },
  { value: 10, label: '10 s' },
];

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
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${height} ${points} ${width},${height}`} fill={color} fillOpacity="0.12" stroke="none" />
    </svg>
  );
}

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
        <button className="msim-spinner-btn" onClick={() => onChange(Math.min(max, value + 1))}>▲</button>
        <button className="msim-spinner-btn" onClick={() => onChange(Math.max(min, value - 1))}>▼</button>
      </div>
    </div>
  );
}

function EscenarioCard({ escenario, selected, onSelect, metricaColor }) {
  return (
    <div
      className={`msim-escenario-card${selected ? ' msim-escenario-card--active' : ''}`}
      style={selected ? { borderColor: escenario.borderColor || metricaColor } : {}}
      onClick={onSelect}
    >
      <div className="msim-escenario-icon" style={{ background: escenario.iconBg }}>{escenario.icon}</div>
      <div className="msim-escenario-nombre">{escenario.nombre}</div>
      <div className="msim-escenario-desc">{escenario.descripcion}</div>
      <div className="msim-escenario-rango" style={{ background: `${escenario.borderColor}22`, color: escenario.borderColor }}>
        {escenario.rangoLabel}
      </div>
    </div>
  );
}

function ModalSimulacion({ isOpen, onClose, fronteras = [] }) {
  const { iniciarZona, detenerZona, zonaSimActiva } = useSimulacion();

  // Métrica activa (global para ambas zonas para simplificar la comparativa)
  const [metricIdx, setMetricIdx] = useState(0);
  
  // Zona que estamos configurando actualmente (0 o 1)
  const [activeZoneIdx, setActiveZoneIdx] = useState(0);

  // Configuraciones por zona: [{ escenarioIdx, dias, intervalMin, intervalSimSeg }]
  const [zoneConfigs, setZoneConfigs] = useState([]);

  useEffect(() => {
    if (isOpen && fronteras.length > 0) {
      // Inicializar configs para cada frontera
      setZoneConfigs(fronteras.map(() => ({
        escenarioIdx: 0,
        dias: 1,
        intervalMin: 60,
        intervalSimSeg: 3
      })));
      setActiveZoneIdx(0);
    }
  }, [isOpen, fronteras]);

  const [isLaunching, setIsLaunching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const metric = ESCENARIOS[metricIdx];
  const currentCfg = zoneConfigs[activeZoneIdx];

  const updateCfg = useCallback((key, value) => {
    setZoneConfigs(prev => {
      const next = [...prev];
      if (next[activeZoneIdx]) {
        next[activeZoneIdx] = { ...next[activeZoneIdx], [key]: value };
      }
      return next;
    });
  }, [activeZoneIdx]);

  const handleIniciar = async () => {
    if (fronteras.length === 0) return;
    setIsLaunching(true);
    try {
      // Preparar payload para el backend
      const config = {
        metricaClave: metric.metricaClave,
        // Usamos los parámetros globales de la primera zona para la sesión (días, etc)
        dias: zoneConfigs[0].dias,
        intervalMinutos: zoneConfigs[0].intervalMin,
        intervalSimSeg: zoneConfigs[0].intervalSimSeg,
        zonas: fronteras.map((f, idx) => {
          const zCfg = zoneConfigs[idx];
          const esc = metric.escenarios[zCfg.escenarioIdx];
          return {
            nombre: f.nombre,
            centroide: calcCenter(f.bbox),
            escenario: esc
          };
        })
      };

      console.log('🚀 Iniciando simulación con config:', config);
      iniciarZona(config);
      onClose();
    } catch (err) {
      console.error('❌ Error al iniciar simulación:', err);
      alert('No se pudo iniciar la simulación. Revisa la consola.');
    } finally {
      setIsLaunching(false);
    }
  };

  function calcCenter(bbox) {
    // bbox: [[lonMin, latMin], [lonMax, latMax]]
    return {
      lng: (bbox[0][0] + bbox[1][0]) / 2,
      lat: (bbox[0][1] + bbox[1][1]) / 2
    };
  }

  if (!isOpen || zoneConfigs.length === 0) return null;

  const escenarioSeleccionado = metric.escenarios[currentCfg.escenarioIdx];

  return (
    <div className="msim-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="msim-box">
        <div className="msim-box-header">
          <span className="msim-box-title">Configurar Simulación Comparativa</span>
          <button className="msim-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Dots de métrica */}
        <div className="msim-dots">
          {ESCENARIOS.map((e, i) => (
            <button
              key={e.metricaClave}
              className={`msim-dot${i === metricIdx ? ' msim-dot--active' : ''}`}
              style={i === metricIdx ? { background: e.categoriaColor } : {}}
              onClick={() => setMetricIdx(i)}
              title={e.nombre}
            />
          ))}
        </div>

        {/* Selector de Zona si hay más de una */}
        {fronteras.length > 1 && (
          <div className="msim-zone-selector">
            {fronteras.map((f, idx) => (
              <button
                key={idx}
                className={`msim-zone-tab${idx === activeZoneIdx ? ' active' : ''}`}
                onClick={() => setActiveZoneIdx(idx)}
              >
                Configurar: {f.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="msim-card">
          <div className="msim-card-top">
            <span className="msim-card-num">{metric.numero}</span>
            <span className="msim-card-num-label">DATO A SIMULAR</span>
            <div className="msim-badge" style={{ background: `${metric.categoriaColor}22`, color: metric.categoriaColor }}>
              {metric.categoria}
            </div>
          </div>

          <h2 className="msim-metric-title">{metric.nombre} en {fronteras[activeZoneIdx]?.nombre}</h2>
          <p className="msim-metric-desc">{metric.descripcion}</p>

          <div className="msim-section-label">SELECCIONA EL ESCENARIO PARA ESTA ZONA</div>
          <div className="msim-escenarios-grid">
            {metric.escenarios.map((esc, idx) => (
              <EscenarioCard
                key={esc.id}
                escenario={esc}
                selected={currentCfg.escenarioIdx === idx}
                onSelect={() => updateCfg('escenarioIdx', idx)}
                metricaColor={metric.categoriaColor}
              />
            ))}
          </div>

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
            </div>
          )}

          {/* Parámetros globales (se toman de la zona 1 para simplificar la sincronización del backend) */}
          {activeZoneIdx === 0 && (
            <div className="msim-controls-row">
              <div className="msim-control-group">
                <label className="msim-ctrl-label">CANTIDAD DE DÍAS</label>
                <NumberSpinner value={currentCfg.dias} min={1} max={30} unit="días" onChange={v => updateCfg('dias', v)} />
              </div>
              <div className="msim-control-group">
                <label className="msim-ctrl-label">INT. GUARDADO</label>
                <select className="msim-select" value={currentCfg.intervalMin} onChange={e => updateCfg('intervalMin', Number(e.target.value))}>
                  {OPCIONES_GUARDADO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="msim-control-group">
                <label className="msim-ctrl-label">VELOCIDAD TICK</label>
                <select className="msim-select" value={currentCfg.intervalSimSeg} onChange={e => updateCfg('intervalSimSeg', Number(e.target.value))}>
                  {OPCIONES_SIM.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}
          {activeZoneIdx > 0 && (
            <div className="msim-info-msg">
              * Los parámetros de tiempo se heredan de la Zona 1 para mantener la sincronización.
            </div>
          )}
        </div>

        <div className="msim-footer">
          <div className="msim-footer-actions">
            <button className="msim-btn msim-btn-preview" onClick={() => setShowPreview(v => !v)}>
              {showPreview ? 'Ocultar' : 'Vista previa'}
            </button>
            {zonaSimActiva ? (
              <button className="msim-btn msim-btn-stop" onClick={detenerZona}>⏹ Detener</button>
            ) : (
              <button
                className="msim-btn msim-btn-start"
                onClick={handleIniciar}
                disabled={isLaunching}
              >
                {isLaunching ? 'Iniciando...' : 'Iniciar Simulación ▶'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModalSimulacion;
