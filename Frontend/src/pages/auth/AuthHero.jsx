import loginMap from '../../assets/mapa_login.png'

function AuthHero() {
  return (
    <aside className="auth-hero">
      <div className="auth-hero-bg" aria-hidden="true">
        <img src={loginMap} alt="Mapa de monitoreo" className="auth-hero-bg-img" />
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
          <div className="tg">Observatorio Ambiental Global · Américas</div>
        </div>
      </div>

      <div className="auth-hero-mid">
        <div className="kicker">Red de sensores</div>
        <h1>
          Observando el aire,<br />
          el agua, el clima y los<br />
          sensores de las Américas<br />
          <em>en tiempo real.</em>
        </h1>
        <p>Una red hemisférica de estaciones meteorológicas que entrega lecturas cada pocos segundos, integrando datos satelitales y de superficie para investigadores y ciudadanos.</p>
      </div>

      <div className="auth-hero-stats">
        <div className="auth-hero-stat">
          <div className="l">Estaciones globales:</div>
          <div className="v">45K+</div>
          <div className="stat-visual-dots" style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8ea389' }}></span>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8ea389' }}></span>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c88f7b' }}></span>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8ea389' }}></span>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d1ab7b' }}></span>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7ba9b5' }}></span>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c88f7b' }}></span>
            <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8ea389' }}></span>
          </div>
        </div>
        <div className="auth-hero-stat">
          <div className="l">Lecturas/minuto:</div>
          <div className="v">1.2M+</div>
          <svg width="60" height="12" viewBox="0 0 60 12" fill="none" style={{ marginTop: '6px' }}>
            <path d="M2 8 C 10 8, 12 2, 20 6 C 28 10, 32 2, 40 7 C 48 12, 50 2, 58 4" stroke="var(--moss-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="auth-hero-stat">
          <div className="l">Datos abiertos:</div>
          <div className="v">15.5 PB+</div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', color: 'var(--ink-mute)' }}>
            {[...Array(5)].map((_, i) => (
              <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19A4.5 4.5 0 0 0 22 14.5c0-2.18-1.56-4-3.66-4.42A6 6 0 0 0 7 11c0 .26.02.51.05.76A4.5 4.5 0 0 0 2.5 16a4.5 4.5 0 0 0 4.5 4.5h10.5" />
              </svg>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default AuthHero
