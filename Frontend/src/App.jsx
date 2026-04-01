import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import MapaMonitoreo from './pages/MapaMonitoreo'
import PanelSimulacion from './pages/PanelSimulacion'
import Reportes from './pages/Reportes'
import Usuarios from './pages/Usuarios'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/mapa" replace />} />
        <Route path="mapa" element={<MapaMonitoreo />} />
        <Route path="simulacion" element={<PanelSimulacion />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>
    </Routes>
  )
}

export default App
