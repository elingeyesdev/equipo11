import { useNavigate } from 'react-router-dom';
import { clearSession } from '../../utils/auth';
import './MobileProfile.css';

export default function MobileProfile() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mobile-page">
      <header className="mobile-page-header">
        <span className="mobile-eyebrow">Mi Cuenta</span>
        <h1 className="mobile-page-title">Perfil</h1>
      </header>

      <div className="mobile-profile-card">
        <div className="mobile-profile-avatar">
          {(usuario.nombre || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="mobile-profile-info">
          <h3>{usuario.nombre} {usuario.apellido || ''}</h3>
          <p>{usuario.email || 'Sin correo'}</p>
          <span className="mobile-profile-role">{usuario.rol_clave || 'usuario'}</span>
        </div>
      </div>

      <button className="mobile-logout-btn" onClick={handleLogout}>
        Cerrar Sesión
      </button>
    </div>
  );
}
