import { Outlet } from 'react-router-dom'
import Navbar from '../Navbar/Navbar'
import Sidebar from '../Sidebar/Sidebar'
import AlertaNotificacion from '../AlertaNotificacion/AlertaNotificacion'
import './Layout.css'

import { useState } from 'react'

function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className={`layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <div className="layout-main">
        <Navbar />
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
