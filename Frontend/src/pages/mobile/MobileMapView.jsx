import './MobileMapView.css';

export default function MobileMapView() {
  return (
    <div className="mobile-page">
      <header className="mobile-page-header">
        <span className="mobile-eyebrow">Visualización</span>
        <h1 className="mobile-page-title">Mapa</h1>
        <p className="mobile-page-subtitle">Vista geoespacial de sensores</p>
      </header>
      <div className="mobile-placeholder-card">
        <span className="mobile-placeholder-icon">🗺️</span>
        <h3>Mapa Interactivo</h3>
        <p>La vista de mapa optimizada para móvil estará disponible próximamente.</p>
        <p className="mobile-placeholder-hint">
          Mientras tanto, accede desde la versión de escritorio para la experiencia completa con Mapbox GL.
        </p>
      </div>
    </div>
  );
}
