import { useState, useEffect, useRef, useCallback } from 'react'
import { useSimulacion } from '../../context/SimulacionContext'
import { useToast } from '../Toast/Toast'
import useFronteras from '../../hooks/useFronteras'
import './FronterasPanel.css'

function SearchableComboBox({ value, onChange, options, disabled, placeholder }) {
  const [query, setQuery] = useState('')
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="fp-combo-container">
      <div className="fp-search-wrapper">
        <span className="fp-search-icon">🔍</span>
        <input
          type="text"
          className="fp-combo-search"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={disabled}
        />
      </div>
      <select 
        className="fp-combo-select"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">-- Selecciona --</option>
        {filtered.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

export default function FronterasPanel({ onBoundarySelect, onStartSimulation, isRunning }) {
  const { addToast } = useToast()
  const { 
    isComparing, setIsComparing, 
    zona1Cfg: zona1, setZona1Cfg: setZona1, 
    zona2Cfg: zona2, setZona2Cfg: setZona2 
  } = useSimulacion()

  const { paises, loadingList, fetchProvincias, fetchGeoBoundary } = useFronteras();

  const emitBoundaries = useCallback((z1, z2, changed) => {
    onBoundarySelect({ z1: z1?.result, z2: isComparing ? z2?.result : null, changed })
  }, [onBoundarySelect, isComparing])

  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (zona1.result || (isComparing && zona2.result)) {
      emitBoundaries(zona1, zona2, 'init')
    }
  }, [zona1, zona2, isComparing, emitBoundaries])

  const fetchGeoForZona = async (zState, setZ, isZ2) => {
    setZ(prev => ({ ...prev, loadingGeo: true }))
    const result = await fetchGeoBoundary(zState.pais, zState.depto, zState.prov)
    setZ(prev => ({ ...prev, result, loadingGeo: false }))
    if (isZ2) emitBoundaries(zona1, { ...zState, result }, 'z2')
    else emitBoundaries({ ...zState, result }, zona2, 'z1')
  }

  const handlePaisChange = async (zState, setZ, p, isZ2) => {
    setZ(prev => ({ ...prev, pais: p, depto: '', prov: '', departamentos: [], provincias: [], result: null }))
    emitBoundaries({ ...zState, result: null }, isZ2 ? zState : null, isZ2 ? 'z2' : 'z1')
    if (p) {
      const pObj = paises.find(x => x.name === p)
      if (pObj && pObj.states) {
        setZ(prev => ({ ...prev, departamentos: pObj.states.sort((a, b) => a.name.localeCompare(b.name)) }))
      }
      await fetchGeoForZona({ ...zState, pais: p, depto: '', prov: '' }, setZ, isZ2)
    }
  }

  const handleDeptoChange = async (zState, setZ, d, isZ2) => {
    setZ(prev => ({ ...prev, depto: d, prov: '', provincias: [], result: null }))
    if (d) {
      const provs = await fetchProvincias(zState.pais, d);
      setZ(prev => ({ ...prev, provincias: provs }))
      await fetchGeoForZona({ ...zState, depto: d, prov: '' }, setZ, isZ2)
    } else {
      await fetchGeoForZona({ ...zState, depto: '', prov: '' }, setZ, isZ2)
    }
  }

  const handleProvChange = async (zState, setZ, pr, isZ2) => {
    setZ(prev => ({ ...prev, prov: pr, result: null }))
    if (pr) await fetchGeoForZona({ ...zState, prov: pr }, setZ, isZ2)
    else await fetchGeoForZona({ ...zState, prov: '' }, setZ, isZ2)
  }

  const handleStart = () => {
    if (!zona1.result) return addToast("Selecciona al menos una zona válida (País/Departamento/Provincia).", 'warning')
    if (isComparing && !zona2.result) return addToast("Selecciona la segunda zona para comparar.", 'warning')

    const fronteras = [zona1.result]
    if (isComparing && zona2.result) fronteras.push(zona2.result)

    onStartSimulation(fronteras)
  }

  const renderFronteraForm = (z, setZ, isZ2) => (
    <div className="fp-zona-box">
      <div className="fp-field">
        <label>País {isZ2 && "2"}</label>
        <SearchableComboBox
          value={z.pais}
          onChange={val => handlePaisChange(z, setZ, val, isZ2)}
          options={paises.map(p => p.name)}
          disabled={paises.length === 0 || isRunning}
          placeholder="Filtrar..."
        />
      </div>
      {z.pais && (
        <div className="fp-field">
          <label>Departamento</label>
          <select value={z.depto} onChange={e => handleDeptoChange(z, setZ, e.target.value, isZ2)} disabled={z.departamentos.length === 0 || isRunning}>
            <option value="">Todo el país</option>
            {z.departamentos.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
        </div>
      )}
      {z.depto && (
        <div className="fp-field">
          <label>Provincia</label>
          <select value={z.prov} onChange={e => handleProvChange(z, setZ, e.target.value, isZ2)} disabled={z.provincias.length === 0 || isRunning}>
            <option value="">Todo el departamento</option>
            {z.provincias.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </select>
        </div>
      )}
      {z.loadingGeo && <div className="fp-msg fp-msg-load">Cargando frontera...</div>}
      {!z.loadingGeo && z.pais && !z.result && <div className="fp-msg fp-msg-err">Frontera no disponible en mapa.</div>}
      {!z.loadingGeo && z.result && <div className="fp-msg fp-msg-ok">Frontera mapeada con éxito.</div>}
    </div>
  )

  return (
    <div className="fronteras-panel">
      <div className="fronteras-header">
        <h4>Fronteras de Simulación</h4>
        {loadingList && <span className="fronteras-spinner"></span>}
      </div>
      
      <div className="fronteras-body">
        <div className="fp-section">
          {renderFronteraForm(zona1, setZona1, false)}
          
          <label className="fp-checkbox">
            <input type="checkbox" checked={isComparing} disabled={isRunning} onChange={e => {
              setIsComparing(e.target.checked)
              if (!e.target.checked) emitBoundaries(zona1, null)
              else emitBoundaries(zona1, zona2)
            }} />
            Comparar con otra frontera
          </label>

          {isComparing && renderFronteraForm(zona2, setZona2, true)}
        </div>
      </div>

      <div className="fronteras-footer">
        <button className="fp-btn-start" onClick={handleStart} disabled={isRunning || !zona1.result || (isComparing && !zona2.result)}>
          {isRunning ? 'Simulación en progreso...' : 'Configurar Simulación'}
        </button>
      </div>
    </div>
  )
}
