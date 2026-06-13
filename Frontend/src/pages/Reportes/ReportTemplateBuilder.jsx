import { useState, useEffect } from 'react';
import httpClient from '../../config/httpClient';
import { useToast } from '../../components/Toast/Toast';
import './Reportes.css'; // Reutilizamos los estilos base de reportes
import '../PagePlaceholder.css';

const VARIABLES = ['Temperatura', 'AQI', 'Viento', 'Lluvia', 'Visibilidad', 'Nieve'];
const OPERATORS = [
  { label: 'Mayor que', value: '>' },
  { label: 'Menor que', value: '<' },
  { label: 'Igual a', value: '=' }
];

export default function ReportTemplateBuilder() {
  const { addToast } = useToast();
  const [plantillas, setPlantillas] = useState([]);
  
  // Estado del Formulario
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [tipo, setTipo] = useState('PERSONALIZADA');
  const [condiciones, setCondiciones] = useState([]);

  // Cargar plantillas al montar
  useEffect(() => {
    fetchPlantillas();
  }, []);

  const fetchPlantillas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await httpClient.get('/plantillas', {
        headers: { Authorization: "Bearer " + token }
      });
      setPlantillas(res.data.data || []);
    } catch (err) {
      addToast('Error al cargar plantillas', 'error');
    }
  };

  // Constructor de Reglas
  const handleAddCondition = () => {
    setCondiciones([...condiciones, { variable: VARIABLES[0], operador: '>', valor: '' }]);
  };

  const handleRemoveCondition = (index) => {
    const nuevasCondiciones = [...condiciones];
    nuevasCondiciones.splice(index, 1);
    setCondiciones(nuevasCondiciones);
  };

  const handleConditionChange = (index, field, value) => {
    const nuevasCondiciones = [...condiciones];
    nuevasCondiciones[index][field] = value;
    setCondiciones(nuevasCondiciones);
  };

  // Guardar en la API
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    
    if (!nombrePlantilla.trim()) {
      return addToast('El nombre de la plantilla es obligatorio', 'warning');
    }

    const payload = {
      nombre_plantilla: nombrePlantilla,
      tipo,
      configuracion: tipo === 'PERSONALIZADA' ? { condiciones } : {}
    };

    console.log("Payload a guardar:", payload);

    try {
      const token = localStorage.getItem('token');
      await httpClient.post('/plantillas', payload, {
        headers: { Authorization: "Bearer " + token }
      });
      addToast('Plantilla guardada con éxito', 'success');
      
      // Limpiar formulario
      setNombrePlantilla('');
      setTipo('PERSONALIZADA');
      setCondiciones([]);
      
      fetchPlantillas(); // Refrescar lista
    } catch (err) {
      addToast('Error al guardar plantilla', 'error');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta plantilla?')) return;
    try {
      const token = localStorage.getItem('token');
      await httpClient.delete(`/plantillas/${id}`, {
        headers: { Authorization: "Bearer " + token }
      });
      addToast('Plantilla eliminada', 'success');
      fetchPlantillas(); // Refrescar lista
    } catch (err) {
      addToast('Error al eliminar', 'error');
    }
  };

  return (
    <div className="page reportes-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Configuración</p>
          <h1 className="page-heading">Constructor de <em>Plantillas</em></h1>
          <p className="page-desc">Crea y gestiona tus configuraciones de reportes inteligentes (procesados en Backend).</p>
        </div>
        <span className="page-tag">{plantillas.length} guardadas</span>
      </div>

      {/* Formulario de nueva plantilla */}
      <div className="rep-filtros" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Nueva Plantilla</h3>
        <form onSubmit={handleSaveTemplate} className="rep-filtros-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label className="rep-label" style={{ minWidth: '200px' }}>
            Nombre
            <input 
              type="text" 
              className="rep-input" 
              value={nombrePlantilla} 
              onChange={e => setNombrePlantilla(e.target.value)} 
              placeholder="Ej: Reporte Logística Noche"
            />
          </label>

          <label className="rep-label" style={{ minWidth: '200px' }}>
            Tipo
            <select className="rep-select" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="PERSONALIZADA">Personalizada</option>
              <option value="ESTANDAR_LOGISTICA">Estándar Logística</option>
              <option value="ESTANDAR_SALUD">Estándar Salud</option>
            </select>
          </label>

          {tipo === 'PERSONALIZADA' && (
            <div style={{ width: '100%', marginTop: '1rem', padding: '1rem', background: 'var(--panel-bg)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '0.8rem', color: 'var(--text-main)' }}>Motor de Reglas</h4>
              {condiciones.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No hay condiciones. Se filtrará sin restricciones dinámicas.</p>}
              
              {condiciones.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select className="rep-select" value={c.variable} onChange={e => handleConditionChange(i, 'variable', e.target.value)}>
                    {VARIABLES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  
                  <select className="rep-select" value={c.operador} onChange={e => handleConditionChange(i, 'operador', e.target.value)}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>

                  <input 
                    type="number" 
                    className="rep-input" 
                    value={c.valor} 
                    onChange={e => handleConditionChange(i, 'valor', e.target.value)} 
                    placeholder="Valor"
                  />

                  <button type="button" className="rep-rango-btn" onClick={() => handleRemoveCondition(i)} style={{ padding: '0.4rem 0.6rem' }}>
                    <svg width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              ))}
              <button type="button" className="rep-rango-btn" onClick={handleAddCondition} style={{ marginTop: '0.5rem' }}>
                + Agregar Condición
              </button>
            </div>
          )}

          {/* Vista previa en tiempo real */}
          <div style={{ width: '100%', marginTop: '1rem', background: '#1e1e1e', padding: '1rem', borderRadius: '6px', overflowX: 'auto' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#888' }}>Vista previa del Payload JSON:</h5>
            <pre className="json-preview" style={{ color: '#00e400', fontSize: '0.85rem', margin: 0 }}>
              {JSON.stringify({ nombre_plantilla: nombrePlantilla, tipo, configuracion: tipo === 'PERSONALIZADA' ? { condiciones } : {} }, null, 2)}
            </pre>
          </div>

          <div className="rep-actions" style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'flex-start' }}>
            <button type="submit" className="rep-export-btn rep-export-xl" style={{ cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Guardar Plantilla
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Plantillas */}
      <div className="rep-tabla-wrap">
        <h3 style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)', margin: 0 }}>Mis Plantillas Guardadas</h3>
        {plantillas.length === 0 ? (
          <div className="rep-estado">No tienes plantillas guardadas en la base de datos.</div>
        ) : (
          <table className="rep-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Creado en</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plantillas.map(p => (
                <tr key={p.id}>
                  <td className="rep-td-ciudad" style={{ fontWeight: 500 }}>{p.nombre_plantilla}</td>
                  <td className="rep-td-valor">
                    <span className="page-tag" style={{ background: 'var(--panel-bg)' }}>{p.tipo.replace('_', ' ')}</span>
                  </td>
                  <td className="rep-td-fecha">{new Date(p.creado_en).toLocaleString()}</td>
                  <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                    <button 
                      className="rep-rango-btn" 
                      onClick={() => handleDeleteTemplate(p.id)}
                      style={{ color: '#ff4b4b', borderColor: 'rgba(255, 75, 75, 0.2)' }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
