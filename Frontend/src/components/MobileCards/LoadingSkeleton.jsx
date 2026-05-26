export default function LoadingSkeleton() {
  return (
    <div className="mobile-page">
      <header className="mobile-dashboard-header">
        <div className="mobile-skeleton mobile-skeleton-eyebrow" />
        <div className="mobile-skeleton mobile-skeleton-title" />
        <div className="mobile-skeleton mobile-skeleton-subtitle" />
      </header>

      <div className="mobile-cards-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="mobile-metric-card mobile-metric-card-skeleton">
            <div className="mobile-skeleton mobile-skeleton-label" />
            <div className="mobile-skeleton mobile-skeleton-value" />
          </div>
        ))}
      </div>
    </div>
  )
}
