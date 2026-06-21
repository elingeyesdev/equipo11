import React from 'react';
import { Link } from 'react-router-dom';

/**
 * LandingCTA — Sección de llamada a la acción final.
 * Un bloque de cierre poderoso antes del footer.
 */
const LandingCTA = () => {
  return (
    <section
      id="contacto"
      style={{
        padding: '6rem 2rem',
        background: 'linear-gradient(135deg, #0B132B 0%, #1C2541 100%)',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,192,190,0.1) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: '-80px',
        right: '-80px',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(58,150,148,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px', margin: '0 auto' }}>
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.78rem',
          fontWeight: '700',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#5BC0BE',
          marginBottom: '1rem',
        }}>
          Empieza hoy
        </p>
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(2rem, 4vw, 3.2rem)',
          fontWeight: '700',
          color: '#FFFFFF',
          letterSpacing: '-0.025em',
          lineHeight: '1.15',
          marginBottom: '1.25rem',
        }}>
          El clima no espera.<br />
          <span style={{
            background: 'linear-gradient(135deg, #5BC0BE, #3A9694)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Tú tampoco deberías.
          </span>
        </h2>
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.05rem',
          color: 'rgba(255,255,255,0.55)',
          lineHeight: '1.7',
          marginBottom: '2.5rem',
        }}>
          Accede a nuestra plataforma y toma el control de los datos ambientales de tu región. Análisis completo, alertas en tiempo real y reportes avanzados.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/login"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.9rem 2.2rem',
              borderRadius: '100px',
              background: '#5BC0BE',
              color: '#0B132B',
              fontWeight: '700',
              fontSize: '1rem',
              textDecoration: 'none',
              transition: 'all 0.25s ease',
              boxShadow: '0 4px 32px rgba(91,192,190,0.4)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 40px rgba(91,192,190,0.55)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 32px rgba(91,192,190,0.4)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            Iniciar Sesión Gratis
          </Link>
          <Link
            to="/"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.9rem 2.2rem',
              borderRadius: '100px',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: '600',
              fontSize: '1rem',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(91,192,190,0.5)';
              e.currentTarget.style.color = '#5BC0BE';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            Ver más información
          </Link>
        </div>
      </div>
    </section>
  );
};

export default LandingCTA;
