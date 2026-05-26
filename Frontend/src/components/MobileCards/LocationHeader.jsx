const RefreshIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

export default function LocationHeader({ city, cityData, onRefresh }) {
  if (!city) {
    return (
      <header className="mobile-dashboard-header">
        <span className="mobile-eyebrow">Ubicación detectada</span>
        <h1 className="mobile-city-name">Ciudad no identificada</h1>
        <p className="mobile-page-subtitle">Sudamérica</p>
      </header>
    )
  }

  const sensorTemp = cityData?.data?.temperatura ?? cityData?.temperatura
  const displayTemperature =
    sensorTemp != null ? `${Number(sensorTemp).toFixed(1)}°C` : null

  return (
    <header className="mobile-dashboard-header">
      <span className="mobile-eyebrow">Ubicación detectada</span>
      <div className="mobile-location-row">
        <h1 className="mobile-city-name">{city.name}</h1>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mobile-refresh-btn"
            aria-label="Refrescar ubicación"
          >
            {RefreshIcon}
          </button>
        )}
      </div>
      {city.distanceKm != null && (
        <p className="mobile-distance-text">{city.distanceKm} km de tu ubicación</p>
      )}
      {displayTemperature && (
        <p className="mobile-current-temp">{displayTemperature}</p>
      )}
      <p className="mobile-page-subtitle">
        {city.pais || 'Sudamérica'}
      </p>
    </header>
  )
}
