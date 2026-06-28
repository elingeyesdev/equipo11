import React from 'react';
import { Link } from 'react-router-dom';

/**
 * LandingFooter — Pie de página de EnviroSense.
 */
const LandingFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: '#0B132B',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '3rem 2rem',
      }}
    >
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/MeteoAdvance.png"
            alt="EnviroSense"
            style={{ height: '32px', width: 'auto', objectFit: 'contain', opacity: 0.85 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: '700',
              fontSize: '1rem',
              color: '#FFFFFF',
            }}>
              Enviro<span style={{ color: '#5BC0BE' }}>Sense</span>
            </div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.35)',
            }}>
              © {year} Todos los derechos reservados.
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Política de Privacidad', href: '#' },
            { label: 'Términos de Servicio', href: '#' },
            { label: 'Contacto', href: '#contacto' },
          ].map(link => (
            <a
              key={link.label}
              href={link.href}
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.4)',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={e => e.target.style.color = '#5BC0BE'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Login link */}
        <Link
          to="/login"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.82rem',
            fontWeight: '600',
            color: '#5BC0BE',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#6BE0DE'}
          onMouseLeave={e => e.currentTarget.style.color = '#5BC0BE'}
        >
          Acceder al sistema →
        </Link>
      </div>
    </footer>
  );
};

export default LandingFooter;
