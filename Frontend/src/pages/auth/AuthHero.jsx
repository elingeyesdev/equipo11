function AuthHero() {
  return (
    <aside className="auth-hero">
      <div className="auth-hero-bg" aria-hidden="true">
        <svg viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="authGrid" patternUnits="userSpaceOnUse" width="32" height="32">
              <path d="M32 0H0v32" fill="none" stroke="#9aa491" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="600" height="700" fill="url(#authGrid)" />
          <path d="M 150 80 L 230 60 L 320 55 L 410 70 L 470 90 L 530 85 L 580 120 L 570 200 L 545 280 L 510 360 L 490 440 L 460 510 L 420 560 L 350 580 L 270 590 L 200 570 L 150 520 L 110 440 L 90 360 L 100 280 L 120 200 L 130 140 Z"
            fill="#cdd2c3" stroke="#9aa491" strokeWidth="1.2" />
          <circle cx="260" cy="280" r="5" fill="#5b8e5f" />
          <circle cx="340" cy="400" r="5" fill="#5b8e5f" />
          <circle cx="420" cy="380" r="5" fill="#c05a3c" />
          <circle cx="380" cy="480" r="5" fill="#5b8e5f" />
          <circle cx="300" cy="170" r="5" fill="#d18a3c" />
        </svg>
      </div>

      <div className="auth-hero-brand">
        <div className="mk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3C7 3 4 7 4 12c0 5 4 9 8 9s8-4 8-9" />
            <path d="M12 3c3 2 4 6 4 9s-1 7-4 9" />
            <path d="M4 12h16" />
          </svg>
        </div>
        <div>
          <div className="nm">EnviroSense</div>
          <div className="tg">Observatorio ambiental · Bolivia</div>
        </div>
      </div>

      <div className="auth-hero-mid">
        <div className="kicker">Red de sensores</div>
        <h1>
          Observando el <em>aire, el agua</em><br />
          y el ruido de Bolivia<br />
          <em>en tiempo real.</em>
        </h1>
        <p>Una red abierta de estaciones distribuidas por los nueve departamentos que entrega lecturas cada pocos segundos a municipios, investigadores y ciudadanos.</p>
      </div>

      <div className="auth-hero-stats">
        <div className="auth-hero-stat">
          <div className="l">Estaciones</div>
          <div className="v">9<span className="live-dot"></span></div>
          <div className="t">activas ahora</div>
        </div>
        <div className="auth-hero-stat">
          <div className="l">Lecturas/día</div>
          <div className="v">25 920</div>
          <div className="t">una cada 3s</div>
        </div>
        <div className="auth-hero-stat">
          <div className="l">Datos abiertos</div>
          <div className="v">1.2 M</div>
          <div className="t">histórico total</div>
        </div>
      </div>
    </aside>
  )
}

export default AuthHero
