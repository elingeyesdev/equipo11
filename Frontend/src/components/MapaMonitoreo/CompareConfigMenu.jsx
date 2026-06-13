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
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
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
