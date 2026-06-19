import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import { isAuthenticated } from './utils/auth'

import { usePwa } from './context/PwaContext'
import MobileLayout from './components/MobileLayout/MobileLayout'
import LandingPage from './pages/LandingPage'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'

import { SimulacionProvider } from './context/SimulacionContext'
import { ZonaSimProvider } from './context/ZonaSimContext'
import { MapVisualsProvider } from './context/MapVisualsContext'

const MapaMonitoreo     = lazy(() => import('./pages/MapaMonitoreo/MapaMonitoreo'))
const Reportes          = lazy(() => import('./pages/Reportes/Reportes'))
const ReportTemplateBuilder = lazy(() => import('./pages/Reportes/ReportTemplateBuilder'))
const ReportModuleTest  = lazy(() => import('./pages/Reportes/ReportModuleTest'))
const Usuarios          = lazy(() => import('./pages/Usuarios/Usuarios'))
const Alertas           = lazy(() => import('./pages/Alertas/Alertas'))
const Notificaciones    = lazy(() => import('./pages/Notificaciones/Notificaciones'))
const LocationDashboard = lazy(() => import('./pages/mobile/LocationDashboard'))
const MobileMapView     = lazy(() => import('./pages/mobile/MobileMapView'))
const AlertHistoryView  = lazy(() => import('./pages/mobile/AlertHistoryView'))
const MobileProfile     = lazy(() => import('./pages/mobile/MobileProfile'))

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

const AppProviders = ({ children }) => (
  <SimulacionProvider>
    <ZonaSimProvider>
      <MapVisualsProvider>
        {children}
      </MapVisualsProvider>
    </ZonaSimProvider>
  </SimulacionProvider>
)

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

          {/* Desktop: AppProviders + Layout */}
          <Route element={
            <ProtectedRoute>
              <DesktopRoute>
                <AppProviders><Layout /></AppProviders>
              </DesktopRoute>
            </ProtectedRoute>
          }>
            <Route path="mapa" element={<MapaMonitoreo />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="test-report" element={<ReportModuleTest />} />
            <Route path="plantillas" element={<ReportTemplateBuilder />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="notificaciones" element={<Notificaciones />} />
          </Route>

          {/* Mobile: AppProviders + MobileLayout */}
          <Route element={
            <ProtectedRoute>
              <MobileRoute>
                <AppProviders><MobileLayout /></AppProviders>
              </MobileRoute>
            </ProtectedRoute>
          }>
            <Route path="mobile" element={<LocationDashboard />} />
            <Route path="mobile/map" element={<MobileMapView />} />
            <Route path="mobile/alerts" element={<AlertHistoryView />} />
            <Route path="mobile/profile" element={<MobileProfile />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
