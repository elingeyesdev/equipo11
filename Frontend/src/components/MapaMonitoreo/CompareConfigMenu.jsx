import React, { useState } from 'react';
import useFronteras from '../../hooks/useFronteras';
import { formatTime } from '../../utils/formatters';
import './CompareConfigMenu.css';

export default function CompareConfigMenu({
  side,
  globalHistoryArray,
  currentIndex,
  onTimeSelect,
  onBoundarySelect
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Spatial state
  const { paises, loadingList, fetchProvincias, fetchGeoBoundary } = useFronteras();
  const [pais, setPais] = useState('');
  const [depto, setDepto] = useState('');
  const [prov, setProv] = useState('');
  const [departamentos, setDepartamentos] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const handlePaisChange = async (e) => {
    const p = e.target.value;
    setPais(p); setDepto(''); setProv('');
    setDepartamentos([]); setProvincias([]);
    if (p) {
      const pObj = paises.find(x => x.name === p);
      if (pObj && pObj.states) setDepartamentos(pObj.states.sort((a,b) => a.name.localeCompare(b.name)));
    }
  };

  const handleDeptoChange = async (e) => {
    const d = e.target.value;
    setDepto(d); setProv(''); setProvincias([]);
    if (d) {
      const provs = await fetchProvincias(pais, d);
      setProvincias(provs);
    }
  };

  const handleApplySpatial = async () => {
    if (!pais) return;
    setLoadingGeo(true);
    const result = await fetchGeoBoundary(pais, depto, prov);
    setLoadingGeo(false);
    if (result) {
      onBoundarySelect(result);
      setIsOpen(false);
    }
  };

  return (
    <div className={`compare-config-menu ${side === 'A' ? 'left' : 'right'}`}>
      <button className="compare-config-btn" onClick={() => setIsOpen(!isOpen)} title={`Configuración Lado ${side}`}>
        ⚙️
      </button>
      {isOpen && (
        <div className="compare-config-popover">
          <div className="cc-header">Configuración {side === 'A' ? 'Izquierda' : 'Derecha'}</div>
          
          <div className="cc-section">
            <label>Dimensión Temporal</label>
            <select 
              value={currentIndex !== null ? currentIndex : ''} 
              onChange={(e) => {
                onTimeSelect(Number(e.target.value));
                setIsOpen(false);
              }}
            >
              <option value="" disabled>-- Selecciona Fecha --</option>
              {globalHistoryArray.map((entry, idx) => (
                <option key={idx} value={idx}>
                  {new Date(entry.timestamp).toLocaleDateString()} {formatTime(entry.timestamp)}
                </option>
              ))}
            </select>
          </div>

          <div className="cc-section">
            <label>Dimensión Espacial</label>
            <select value={pais} onChange={handlePaisChange} disabled={paises.length === 0}>
              <option value="">-- País --</option>
              {paises.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            {pais && (
              <select value={depto} onChange={handleDeptoChange} disabled={departamentos.length === 0}>
                <option value="">-- Departamento --</option>
                {departamentos.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            )}
            {depto && (
              <select value={prov} onChange={(e) => setProv(e.target.value)} disabled={provincias.length === 0}>
                <option value="">-- Provincia --</option>
                {provincias.map(pr => <option key={pr} value={pr}>{pr}</option>)}
              </select>
            )}
            <button className="cc-apply-btn" onClick={handleApplySpatial} disabled={!pais || loadingGeo}>
              {loadingGeo ? 'Cargando...' : 'Ir a Destino'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
