import { useLocation } from 'react-router-dom'
import './Navbar.css'

const pageTitles = {
  '/mapa': { title: 'Mapa de Monitoreo', desc: 'Visualización en tiempo real de sensores ambientales' },
  '/simulacion': { title: 'Panel de Simulación', desc: 'Control y configuración de datos simulados' },
  '/reportes': { title: 'Área de Reportes', desc: 'Generación y descarga de reportes ambientales' },
  '/usuarios': { title: 'Administración de Usuarios', desc: 'Gestión de accesos y permisos del sistema' },
}

function Navbar() {
  const location = useLocation()
  const current = pageTitles[location.pathname] || { title: 'EnviroSense', desc: '' }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h1 className="navbar-title">{current.title}</h1>
        {current.desc && <p className="navbar-desc">{current.desc}</p>}
      </div>
      <div className="navbar-right">
        <div className="navbar-badge navbar-badge--air">
          <span className="badge-dot"></span>
          Aire
        </div>
        <div className="navbar-badge navbar-badge--water">
          <span className="badge-dot"></span>
          Agua
        </div>
        <div className="navbar-badge navbar-badge--noise">
          <span className="badge-dot"></span>
          Ruido
        </div>
        <div className="navbar-badge navbar-badge--climate">
          <span className="badge-dot"></span>
          Clima
        </div>
        <div className="navbar-user">
          <div className="navbar-avatar">AD</div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
