import { useState } from 'react';
import { useSimulacion } from '../../context/SimulacionContext';
import { useUnidades } from '../../hooks/useUnidades';
import { invertirValor, METRICAS_UNIDADES } from '../../utils/unidades';
import './ModalInyeccion.css';

const METRICS = [
  { key: 'aqi',        label: 'Calidad del Aire',  icon: '🌫️', unit: 'AQI' },
  { key: 'ica',        label: 'Calidad del Agua',  icon: '💧', unit: 'ICA' },
  { key: 'ruido',      label: 'Nivel de Ruido',    icon: '🔊', unit: 'dB'  },
  { key: 'temperatura',label: 'Temperatura',       icon: '🌡️', unit: '°C'  },
  { key: 'humedad',    label: 'Humedad',           icon: '💦', unit: '%'   },
];

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
      <div className="minject-box">
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
                className="minject-select"
                value={injectCity}
                onChange={(e) => handleCitySelect(e.target.value)}
                required
              >
                <option value="">-- Selecciona un departamento --</option>
                {(cities.length > 0 ? cities : [
                  { id: 'lapaz', name: 'La Paz' }, { id: 'cochabamba', name: 'Cochabamba' },
                  { id: 'santacruz', name: 'Santa Cruz' }, { id: 'oruro', name: 'Oruro' },
                  { id: 'potosi', name: 'Potosí' }, { id: 'sucre', name: 'Sucre' },
                  { id: 'tarija', name: 'Tarija' }, { id: 'beni', name: 'Trinidad' },
                  { id: 'pando', name: 'Cobija' }
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
