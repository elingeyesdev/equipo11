import { Outlet } from 'react-router-dom'
import Navbar from '../Navbar/Navbar'
import Sidebar from '../Sidebar/Sidebar'
import AlertaNotificacion from '../AlertaNotificacion/AlertaNotificacion'
import './Layout.css'

import { useState } from 'react'

function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <div className={`layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {/* Backdrop para cerrar menú en móvil */}
      {isMobileMenuOpen && <div className="layout-backdrop" onClick={closeMobileMenu} />}
      
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={closeMobileMenu}
      />
      <div className="layout-main">
        <Navbar onMenuToggle={toggleMobileMenu} />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
      {/* Notificaciones de alertas — visibles en todas las páginas */}
      <AlertaNotificacion />
    </div>
  )
}

export default Layout
