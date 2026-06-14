import { useState, useEffect, useMemo } from 'react';
import httpClient from '../../config/httpClient';
import { useRadarSampling } from '../../hooks/useRadarSampling';
import { formatDateTime } from '../../utils/formatters';
import './Reportes.css';

const CIUDADES_BOLIVIA = [
  { nombre: 'La Paz',       latitude: -16.4897, longitude: -68.1193 },
  { nombre: 'Cochabamba',   latitude: -17.3895, longitude: -66.1568 },
  { nombre: 'Santa Cruz',   latitude: -17.7833, longitude: -63.1812 },
  { nombre: 'Oruro',        latitude: -17.9624, longitude: -67.1061 },
  { nombre: 'Potosí',       latitude: -19.5836, longitude: -65.7531 },
  { nombre: 'Sucre',        latitude: -19.0353, longitude: -65.2592 },
  { nombre: 'Tarija',       latitude: -21.5355, longitude: -64.7296 },
  { nombre: 'Trinidad',     latitude: -14.8333, longitude: -64.9000 },
  { nombre: 'Cobija',       latitude: -11.0267, longitude: -68.7692 },
];

export default function AtmosfericoTab() {
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [showImage, setShowImage] = useState(true);

  useEffect(() => {
    httpClient.get('/radar/available-dates')
      .then(res => {
        const dates = res.data?.data || [];
        setAvailableDates(dates);
        if (dates.length > 0) setSelectedTime(dates[dates.length - 1]);
      })
      .catch(() => {});
  }, []);

  const { sampledData, loading } = useRadarSampling(selectedTime, CIUDADES_BOLIVIA);

  const pngUrl = useMemo(() => {
    if (!selectedTime) return '';
    const base = httpClient.defaults.baseURL;
    return `${base}/radar/bolivia/temp/png?time=${encodeURIComponent(selectedTime)}`;
  }, [selectedTime]);

  const handleTimeChange = (dir) => {
    const idx = availableDates.indexOf(selectedTime);
    if (dir === 'prev' && idx > 0) setSelectedTime(availableDates[idx - 1]);
    if (dir === 'next' && idx < availableDates.length - 1) setSelectedTime(availableDates[idx + 1]);
  };

  const idxActual = availableDates.indexOf(selectedTime);

  return (
    <div className="atm-tab">
      <div className="atm-header">
        <h3 className="atm-title">Mapa Atmosférico <em>Decodificado</em></h3>
        <p className="atm-desc">
          Selecciona un instante de tiempo para decodificar los valores numéricos
          de los píxeles del radar en las coordenadas de cada ciudad.
        </p>
      </div>

      <div className="atm-controls">
        <div className="atm-time-nav">
          <button className="rep-rango-btn" onClick={() => handleTimeChange('prev')} disabled={idxActual <= 0}>
            ← Anterior
          </button>
          <select
            className="rep-select"
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
            style={{ minWidth: '260px', textAlign: 'center' }}
          >
            {availableDates.map(d => (
              <option key={d} value={d}>{formatDateTime(d)}</option>
            ))}
          </select>
          <button className="rep-rango-btn" onClick={() => handleTimeChange('next')} disabled={idxActual >= availableDates.length - 1}>
            Siguiente →
          </button>
        </div>

        <label className="atm-toggle-label">
          <input type="checkbox" checked={showImage} onChange={e => setShowImage(e.target.checked)} />
          <span>Mostrar imagen PNG</span>
        </label>
      </div>

      {showImage && pngUrl && (
        <div className="atm-png-wrap">
          <img
            src={pngUrl}
            alt="Mapa atmosférico"
            className="atm-png-img"
            style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--line-soft)' }}
          />
        </div>
      )}

      <div className="atm-table-wrap">
        {loading ? (
          <div className="rep-estado">Decodificando píxeles del radar…</div>
        ) : sampledData.length === 0 ? (
          <div className="rep-estado">Selecciona un instante de tiempo para ver los datos decodificados.</div>
        ) : (
          <table className="rep-tabla">
            <thead>
              <tr>
                <th>Ciudad</th>
                <th>Temp (°C)</th>
                <th>Lluvia (mm/h)</th>
                <th>Viento (km/h)</th>
                <th>Visibilidad (m)</th>
                <th>Nieve Acum (cm)</th>
                <th>Nieve Fresca (cm)</th>
                <th>AQI</th>
              </tr>
            </thead>
            <tbody>
              {sampledData.map((row, i) => (
                <tr key={i}>
                  <td className="rep-td-ciudad">{row.nombre}</td>
                  <td className="rep-td-valor">{row.temp !== null ? `${row.temp.toFixed(1)}°C` : '—'}</td>
                  <td className="rep-td-valor">{row.rain !== null ? `${row.rain.toFixed(1)} mm/h` : '—'}</td>
                  <td className="rep-td-valor">{row.windSpeed !== null ? `${row.windSpeed.toFixed(1)} km/h` : '—'}</td>
                  <td className="rep-td-valor">{row.visibility !== null ? `${row.visibility.toFixed(0)} m` : '—'}</td>
                  <td className="rep-td-valor">{row.snowAccum !== null ? `${row.snowAccum.toFixed(1)} cm` : '—'}</td>
                  <td className="rep-td-valor">{row.snowFresh !== null ? `${row.snowFresh.toFixed(1)} cm` : '—'}</td>
                  <td className="rep-td-valor">{row.aqi !== null ? row.aqi.toFixed(0) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && sampledData.length > 0 && (
        <p className="rep-nota">
          Valores decodificados de los píxeles del radar GFS para {formatDateTime(selectedTime)}.
          Los campos con "—" indican que el PNG correspondiente no pudo cargarse.
        </p>
      )}
    </div>
  );
}
