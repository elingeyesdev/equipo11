import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import MapaMonitoreo from './pages/MapaMonitoreo/MapaMonitoreo'
import Reportes from './pages/Reportes/Reportes'
import Usuarios from './pages/Usuarios/Usuarios'
import Alertas from './pages/Alertas/Alertas'
import Notificaciones from './pages/Notificaciones/Notificaciones'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import { isAuthenticated } from './utils/auth'

function RootRedirect() {
  return <Navigate to={isAuthenticated() ? '/mapa' : '/login'} replace />
}

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

function GuestRoute({ children }) {
  if (isAuthenticated()) return <Navigate to="/mapa" replace />
  return children
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="mapa" element={<MapaMonitoreo />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="notificaciones" element={<Notificaciones />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
