import './PagePlaceholder.css'

function MapaMonitoreo() {
  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-heading">Mapa de Monitoreo</h2>
        <span className="page-tag">Sprint 0</span>
      </div>
      <div className="placeholder-card">
        <div className="placeholder-icon">🗺️</div>
        <h3>Mapa Interactivo de Sensores</h3>
        <p>Aquí se renderizará el mapa de monitoreo ambiental con los puntos de sensores de calidad del aire, agua, ruido y clima.</p>
        <div className="placeholder-chips">
          <span className="chip chip--air">Calidad del Aire</span>
          <span className="chip chip--water">Calidad del Agua</span>
          <span className="chip chip--noise">Nivel de Ruido</span>
          <span className="chip chip--climate">Clima</span>
        </div>
        <div className="placeholder-pending">⏳ Pendiente de implementación</div>
      </div>
    </div>
  )
}

export default MapaMonitoreo
