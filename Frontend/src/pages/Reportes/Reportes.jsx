import '../PagePlaceholder.css'

function Reportes() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Módulo en construcción · Sprint 1</div>
          <h2 className="page-heading">Área de <em>reportes</em></h2>
          <p className="page-desc">Generación, filtrado y descarga de reportes históricos de datos ambientales.</p>
        </div>
        <span className="page-tag">Sprint 1</span>
      </div>
      <div className="placeholder-card">
        <div className="placeholder-icon">📄</div>
        <h3>Generación de <em>reportes</em></h3>
        <p>Módulo para la generación, filtrado y descarga de reportes históricos de datos ambientales, agrupados por fecha, zona o tipo de dato.</p>
        <div className="placeholder-chips">
          <span className="chip chip--air">Por fecha</span>
          <span className="chip chip--water">Por zona</span>
          <span className="chip chip--noise">Por tipo de dato</span>
          <span className="chip chip--climate">Exportar PDF</span>
        </div>
        <div className="placeholder-pending">⏳ Pendiente — Sprint 1</div>
      </div>
    </div>
  )
}

export default Reportes
