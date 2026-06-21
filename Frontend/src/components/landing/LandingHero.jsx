import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* Animated SVG wave that mimics the Wix template's flowing wave shape */
const WaveBackground = () => (
  <div style={{
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    lineHeight: 0,
    pointerEvents: 'none',
  }}>
    <svg
      viewBox="0 0 1440 320"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5BC0BE" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#3A9694" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#1C2541" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1C2541" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#5BC0BE" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0B132B" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* Back wave */}
      <path
        d="M0,160 C180,220 360,90 540,150 C720,210 900,80 1080,140 C1260,200 1380,100 1440,120 L1440,320 L0,320 Z"
        fill="url(#waveGrad2)"
        style={{ animation: 'waveFloat2 8s ease-in-out infinite alternate' }}
      />
      {/* Front wave */}
      <path
        d="M0,200 C160,140 320,250 480,190 C640,130 800,240 960,180 C1120,120 1300,200 1440,170 L1440,320 L0,320 Z"
        fill="url(#waveGrad1)"
        style={{ animation: 'waveFloat 6s ease-in-out infinite alternate' }}
      />
      {/* Highlight wave line */}
      <path
        d="M0,210 C200,170 400,250 600,200 C800,150 1000,230 1200,185 C1350,150 1420,190 1440,180"
        fill="none"
        stroke="rgba(91,192,190,0.6)"
        strokeWidth="1.5"
        style={{ animation: 'waveFloat 7s ease-in-out infinite alternate-reverse' }}
      />
    </svg>
    <style>{`
      @keyframes waveFloat {
        0% { transform: translateX(0px) scaleY(1); }
        100% { transform: translateX(-25px) scaleY(1.04); }
      }
      @keyframes waveFloat2 {
        0% { transform: translateX(0px) scaleY(1); }
        100% { transform: translateX(20px) scaleY(0.97); }
      }
    `}</style>
  </div>
);

const LandingHero = () => {
  return (
    <section
      id="inicio"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        paddingTop: '72px',
      }}
    >
      {/* Hero background map image */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/hero-meteo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center right',
        backgroundRepeat: 'no-repeat',
      }} />

      {/* Gradient overlay — left strong, right transparent so the map shows */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(105deg, rgba(11,19,43,0.97) 0%, rgba(11,19,43,0.85) 40%, rgba(11,19,43,0.45) 70%, rgba(11,19,43,0.15) 100%)',
      }} />

      {/* Subtle grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(91,192,190,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(91,192,190,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 2rem',
        width: '100%',
        paddingBottom: '120px',
      }}>
        {/* Label pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(91,192,190,0.12)',
          border: '1px solid rgba(91,192,190,0.3)',
          borderRadius: '100px',
          padding: '0.35rem 1rem',
          marginBottom: '1.75rem',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#5BC0BE',
            boxShadow: '0 0 8px #5BC0BE',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.78rem',
            fontWeight: '600',
            color: '#5BC0BE',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Sistema de Monitoreo en Vivo
          </span>
        </div>

        {/* Main heading */}
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(2.8rem, 6vw, 5.2rem)',
          fontWeight: '700',
          color: '#FFFFFF',
          lineHeight: '1.08',
          letterSpacing: '-0.03em',
          maxWidth: '680px',
          marginBottom: '1.5rem',
        }}>
          Transformamos datos climáticos en{' '}
          <span style={{
            background: 'linear-gradient(135deg, #5BC0BE, #3A9694)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            decisiones estratégicas
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(1rem, 2vw, 1.2rem)',
          color: 'rgba(255,255,255,0.68)',
          maxWidth: '520px',
          lineHeight: '1.65',
          marginBottom: '2.5rem',
          fontWeight: '400',
        }}>
          Plataforma avanzada de análisis meteorológico e inteligencia ambiental para Sudamérica. Datos en tiempo real, predicciones con IA y alertas instantáneas.
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link
            to="/login"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 2rem',
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
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 40px rgba(91,192,190,0.55)';
              e.currentTarget.style.background = '#6BE0DE';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 32px rgba(91,192,190,0.4)';
              e.currentTarget.style.background = '#5BC0BE';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            Explorar el Mapa
          </Link>

          <Link
            to="/login"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 2rem',
              borderRadius: '100px',
              background: 'transparent',
              color: '#FFFFFF',
              fontWeight: '600',
              fontSize: '1rem',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.25)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(91,192,190,0.6)';
              e.currentTarget.style.color = '#5BC0BE';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
          >
            Iniciar Sesión
          </Link>
        </div>

        {/* Trust indicators */}
        <div style={{
          marginTop: '3.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          flexWrap: 'wrap',
        }}>
          {[
            { icon: '🌐', label: 'NOAA NOMADS' },
            { icon: '📡', label: 'Open-Meteo' },
            { icon: '🛰️', label: 'Sensores IoT' },
          ].map((src) => (
            <div key={src.label} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              color: 'rgba(255,255,255,0.45)',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.8rem',
              fontWeight: '500',
            }}>
              <span style={{ fontSize: '0.9rem' }}>{src.icon}</span>
              {src.label}
            </div>
          ))}
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', fontFamily: "'Space Grotesk', sans-serif" }}>
            Fuentes certificadas de datos
          </span>
        </div>
      </div>

      {/* Animated wave at bottom */}
      <WaveBackground />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </section>
  );
};

export default LandingHero;
