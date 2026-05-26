import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import AlertaNotificacion from '../AlertaNotificacion/AlertaNotificacion';
import './MobileLayout.css';

/**
 * Layout para la experiencia PWA móvil.
 * Reemplaza el Sidebar + Navbar del desktop por un bottom navigation.
 */
export default function MobileLayout() {
  return (
    <div className="mobile-layout">
      <main className="mobile-content">
        <Outlet />
      </main>
      <BottomNav />
      <AlertaNotificacion />
    </div>
  );
}
