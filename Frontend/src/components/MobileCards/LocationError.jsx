export default function LocationError({ message, onRetry }) {
  return (
    <div className="mobile-page">
      <div className="mobile-error-card">
        <div className="mobile-error-icon">&#x1F4CD;</div>
        <h2 className="mobile-error-title">Ubicación no disponible</h2>
        <p className="mobile-error-message">{message}</p>
        {onRetry && (
          <button className="mobile-retry-btn" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
