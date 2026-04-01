import './PagePlaceholder.css'

function PanelSimulacion() {
  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-heading">Panel de Simulación</h2>
        <span className="page-tag">Sprint 0</span>
      </div>
      <div className="placeholder-card">
        <div className="placeholder-icon">⚙️</div>
        <h3>Control de Datos Simulados</h3>
        <p>Desde aquí se podrán configurar y controlar los parámetros de simulación de datos ambientales para pruebas y desarrollo.</p>
        <div className="placeholder-chips">
          <span className="chip chip--air">Frecuencia</span>
          <span className="chip chip--water">Rango de valores</span>
          <span className="chip chip--noise">Sensores activos</span>
          <span className="chip chip--climate">Ubicaciones</span>
        </div>
        <div className="placeholder-pending">⏳ Pendiente de implementación</div>
      </div>
    </div>
  )
}

export default PanelSimulacion
