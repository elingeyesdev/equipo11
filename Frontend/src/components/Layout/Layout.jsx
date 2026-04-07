import { Outlet } from 'react-router-dom'
import Navbar from '../Navbar/Navbar'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout-main">
        <Navbar />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
