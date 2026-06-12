import { useState } from 'react';
import { useSimulacion } from '../../context/SimulacionContext';
import { useUnidades } from '../../hooks/useUnidades';
import { invertirValor, METRICAS_UNIDADES } from '../../utils/unidades';
import './ModalInyeccion.css';

const METRICS = [
  { key: 'aqi',        label: 'Calidad del Aire',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 14h16"/><path d="M4 10h16"/><path d="M4 18h16"/><path d="M4 6h16"/></svg>, unit: 'AQI' },
  { key: 'ica',        label: 'Calidad del Agua',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>, unit: 'ICA' },
  { key: 'ruido',      label: 'Nivel de Ruido',    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>, unit: 'dB'  },
  { key: 'temperatura',label: 'Temperatura',       icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M11.5 6.5v6"/></svg>, unit: '°C'  },
  { key: 'humedad',    label: 'Humedad',           icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>, unit: '%'   },
];

// Fuente canónica: GET /api/sensores/metricas-limites
// TODO: reemplazar con fetch al endpoint al migrar a httpClient (Paso 3.1)
const METRIC_LIMITS = {
  temperatura: { min: -40, max: 60 },
  aqi:         { min: 0,   max: 500 },
  ica:         { min: 0,   max: 100 },
  ruido:       { min: 0,   max: 140 },
  humedad:     { min: 0,   max: 100 },
};

const EMPTY_INJECT = { temperatura: '', aqi: '', ica: '', ruido: '', humedad: '' };

function ModalInyeccion({ isOpen, onClose }) {
  const { cities, inyectar } = useSimulacion();
  const { unidades } = useUnidades();

  const [injectCity, setInjectCity] = useState('');
  const [injectValues, setInjectValues] = useState(EMPTY_INJECT);

  if (!isOpen) return null;

  function handleCitySelect(cityId) {
    setInjectCity(cityId);
    const city = cities.find(c => c.id === cityId);
    setInjectValues(city
      ? { temperatura: city.data.temperatura, aqi: city.data.aqi, ica: city.data.ica, ruido: city.data.ruido, humedad: city.data.humedad }
      : EMPTY_INJECT
    );
  }

  function handleInjectSubmit(e) {
    e.preventDefault();
    if (!injectCity) return;

    const data = {};
    Object.entries(injectValues).forEach(([key, val]) => {
      if (val !== '') data[key] = parseFloat(Number(val).toFixed(2));
    });
    if (Object.keys(data).length === 0) return;

    inyectar(injectCity, data);
    // Optionally alert or show a toast
    onClose();
  }

  function injectDisplayValue(metricKey) {
    const base = injectValues[metricKey];
    if (base === '') return '';
    const cfg = METRICAS_UNIDADES[metricKey];
    const unit = cfg?.unidades.find(u => u.key === unidades[metricKey]) ?? cfg?.unidades[0];
    return parseFloat(unit.convertir(Number(base)).toFixed(unit.precision));
  }

  function handleInjectChange(metricKey, displayVal) {
    if (displayVal === '') {
      setInjectValues(prev => ({ ...prev, [metricKey]: '' }));
      return;
    }
    const base = invertirValor(metricKey, Number(displayVal), unidades[metricKey]);
    setInjectValues(prev => ({ ...prev, [metricKey]: base }));
  }

  return (
    <div className="minject-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="minject-box text-[var(--text-primary)] shadow-2xl rounded-xl p-6" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', borderWidth: '1px', borderStyle: 'solid' }}>
        <div className="minject-box-header">
          <span className="minject-box-title">Inyección Manual de Datos</span>
          <button type="button" className="minject-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="minject-body">
          <p className="minject-subtitle">Escribe los valores que quieras y envíalos directamente al mapa.</p>
          
          <form className="minject-form" onSubmit={handleInjectSubmit}>
            <div className="minject-field minject-field--full">
              <label className="minject-label">Departamento</label>
              <select
                className="minject-select bg-[var(--bg-app)] text-[var(--text-primary)] border border-[var(--border-color)] outline-none"
                value={injectCity}
                onChange={(e) => handleCitySelect(e.target.value)}
                required
              >
                <option value="">-- Selecciona un departamento --</option>
                {(cities.length > 0 ? cities : [
                  { id: 'lapaz', name: 'La Paz' }, { id: 'cochabamba', name: 'Cochabamba' },
                  { id: 'santacruz', name: 'Santa Cruz' }, { id: 'oruro', name: 'Oruro' },
                  { id: 'potosi', name: 'Potosí' }, { id: 'sucre', name: 'Sucre' },
                  { id: 'tarija', name: 'Tarija' }, { id: 'trinidad', name: 'Trinidad' },
                  { id: 'cobija', name: 'Cobija' }
                ]).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="minject-metrics-grid">
              {METRICS.map(m => {
                const unitCfg = METRICAS_UNIDADES[m.key];
                const unitActiva = unitCfg?.unidades.find(u => u.key === unidades[m.key]) ?? unitCfg?.unidades[0];
                const step = unitActiva ? Math.pow(10, -unitActiva.precision) : 1;
                return (
                  <div key={m.key} className="minject-field">
                    <label className="minject-label">
                      {m.icon} {m.label} <span className="minject-unit">({unitActiva?.sufijo.trim() || m.unit})</span>
                    </label>
                    <input
                      type="number"
                      step={step}
                      min={METRIC_LIMITS[m.key]?.min ?? 0}
                      max={METRIC_LIMITS[m.key]?.max ?? 100}
                      className="minject-input"
                      value={injectDisplayValue(m.key)}
                      onChange={(e) => handleInjectChange(m.key, e.target.value)}
                      placeholder="—"
                      disabled={!injectCity}
                    />
                  </div>
                );
              })}
            </div>

            <div className="minject-footer">
              <button
                type="button"
                className="minject-btn-reset"
                onClick={() => { setInjectCity(''); setInjectValues(EMPTY_INJECT); }}
              >
                Limpiar
              </button>
              <button
                type="submit"
                className="minject-btn-send"
                disabled={!injectCity}
              >
                Inyectar al mapa 🚀
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ModalInyeccion;
