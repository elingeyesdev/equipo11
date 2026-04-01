import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import MapaMonitoreo from './pages/MapaMonitoreo'
import PanelSimulacion from './pages/PanelSimulacion'
import Reportes from './pages/Reportes'
import Usuarios from './pages/Usuarios'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Protege las rutas que requieren sesión activa (Desactivado para MVP)
function ProtectedRoute({ children }) {
  // const usuario = localStorage.getItem('usuario')
  // if (!usuario) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <Routes>
      {/* Rutas públicas (sin sidebar/navbar) */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Rutas con layout principal (Ahora sin bloqueo de auth obligatoria) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/mapa" replace />} />
        <Route path="mapa"       element={<MapaMonitoreo />} />
        <Route path="simulacion" element={<PanelSimulacion />} />
        <Route path="reportes"   element={<Reportes />} />
        <Route path="usuarios"   element={<Usuarios />} />
      </Route>

      {/* Ruta fallback: Si la url no existe, o entramos en localhost directamente, vamos al mapa */}
      <Route path="*" element={<Navigate to="/mapa" replace />} />
    </Routes>
  )
}

export default App
