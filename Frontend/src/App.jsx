import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import MapaMonitoreo from './pages/MapaMonitoreo/MapaMonitoreo'
import Reportes from './pages/Reportes/Reportes'
import ReportTemplateBuilder from './pages/Reportes/ReportTemplateBuilder'
import ReportModuleTest from './pages/Reportes/ReportModuleTest'
import Usuarios from './pages/Usuarios/Usuarios'
import Alertas from './pages/Alertas/Alertas'
import Notificaciones from './pages/Notificaciones/Notificaciones'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import { isAuthenticated } from './utils/auth'

import { usePwa } from './context/PwaContext'
import MobileLayout from './components/MobileLayout/MobileLayout'
import LocationDashboard from './pages/mobile/LocationDashboard'
import MobileMapView from './pages/mobile/MobileMapView'
import AlertHistoryView from './pages/mobile/AlertHistoryView'
import MobileProfile from './pages/mobile/MobileProfile'

function RootRedirect() {
  const { isPWA } = usePwa()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return <Navigate to={isPWA ? '/mobile' : '/mapa'} replace />
}

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

function GuestRoute({ children }) {
  const { isPWA } = usePwa()
  if (isAuthenticated()) return <Navigate to={isPWA ? '/mobile' : '/mapa'} replace />
  return children
}

function DesktopRoute({ children }) {
  const { isPWA } = usePwa()
  if (isPWA) return <Navigate to="/mobile" replace />
  return children
}

function MobileRoute({ children }) {
  const { isPWA } = usePwa()
  if (!isPWA) return <Navigate to="/mapa" replace />
  return children
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

        <Route element={<ProtectedRoute><DesktopRoute><Layout /></DesktopRoute></ProtectedRoute>}>
          <Route path="mapa" element={<MapaMonitoreo />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="test-report" element={<ReportModuleTest />} />
          <Route path="plantillas" element={<ReportTemplateBuilder />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="notificaciones" element={<Notificaciones />} />
        </Route>

        {/* Rutas PWA Mobile */}
        <Route element={<ProtectedRoute><MobileRoute><MobileLayout /></MobileRoute></ProtectedRoute>}>
          <Route path="mobile" element={<LocationDashboard />} />
          <Route path="mobile/map" element={<MobileMapView />} />
          <Route path="mobile/alerts" element={<AlertHistoryView />} />
          <Route path="mobile/profile" element={<MobileProfile />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
