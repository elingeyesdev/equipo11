import { useLocation, useNavigate } from 'react-router-dom'
import './Navbar.css'

const pageCrumbs = {
  '/mapa':       { group: 'Observación', leaf: 'Mapa de Monitoreo' },
  '/simulacion': { group: 'Operación',   leaf: 'Simulación' },
  '/reportes':   { group: 'Operación',   leaf: 'Reportes' },
  '/usuarios':   { group: 'Operación',   leaf: 'Usuarios' },
}

function Navbar({ onMenuToggle }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const current = pageCrumbs[location.pathname] || { group: 'EnviroSense', leaf: '—' }

  const handleLogout = () => {
    localStorage.removeItem('usuario')
    navigate('/login')
  }

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="navbar-menu-btn" onClick={onMenuToggle} aria-label="Abrir menú">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <p className="navbar-title">
          <span>EnviroSense · Bolivia</span> / {current.group} / <b>{current.leaf}</b>
        </p>
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
          <button className="navbar-logout" onClick={handleLogout} title="Cerrar sesión">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
