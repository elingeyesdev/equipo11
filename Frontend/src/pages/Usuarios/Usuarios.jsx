import '../PagePlaceholder.css'

function Usuarios() {
  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-heading">Administración de Usuarios</h2>
        <span className="page-tag">Admin</span>
      </div>
      <div className="placeholder-card">
        <div className="placeholder-icon">👥</div>
        <h3>Gestión de Usuarios</h3>
        <p>Panel para administrar los usuarios del sistema, sus roles, permisos de acceso y responsables de cada zona ambiental.</p>
        <div className="placeholder-chips">
          <span className="chip chip--air">Roles</span>
          <span className="chip chip--water">Permisos</span>
          <span className="chip chip--noise">Responsables</span>
          <span className="chip chip--climate">Zonas asignadas</span>
        </div>
        <div className="placeholder-pending">⏳ Pendiente de implementación</div>
      </div>
    </div>
  )
}

export default Usuarios
