import React, { useEffect, useRef, useState } from 'react';

/**
 * LandingFeatures — Sección 2 "Plataforma"
 * 3 pilares del modelo de negocio de MeteoroAdvanced.
 * Replicando el estilo de la sección "Llevar tu negocio al siguiente nivel" del template Wix.
 */

/* Decorative abstract SVG icons matching the Wix geometric style */
const IconRadar = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="28" r="20" stroke="#5BC0BE" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4"/>
    <circle cx="28" cy="28" r="12" stroke="#5BC0BE" strokeWidth="1.5" opacity="0.6"/>
    <circle cx="28" cy="28" r="4" fill="#5BC0BE"/>
    <line x1="28" y1="28" x2="44" y2="16" stroke="#5BC0BE" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
    <circle cx="18" cy="16" r="5" fill="rgba(91,192,190,0.15)" stroke="#5BC0BE" strokeWidth="1" opacity="0.5"/>
    <circle cx="42" cy="38" r="3" fill="rgba(91,192,190,0.1)" stroke="#5BC0BE" strokeWidth="1" opacity="0.4"/>
  </svg>
);

const IconAI = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="18" width="32" height="22" rx="4" stroke="#5BC0BE" strokeWidth="1.5" fill="rgba(91,192,190,0.05)"/>
    <line x1="20" y1="27" x2="20" y2="31" stroke="#5BC0BE" strokeWidth="2" strokeLinecap="round"/>
    <line x1="28" y1="24" x2="28" y2="34" stroke="#5BC0BE" strokeWidth="2" strokeLinecap="round"/>
    <line x1="36" y1="26" x2="36" y2="32" stroke="#5BC0BE" strokeWidth="2" strokeLinecap="round"/>
    <line x1="28" y1="10" x2="28" y2="18" stroke="#5BC0BE" strokeWidth="1.5" opacity="0.5"/>
    <circle cx="28" cy="10" r="3" fill="rgba(91,192,190,0.2)" stroke="#5BC0BE" strokeWidth="1.2"/>
    <circle cx="16" cy="40" r="2.5" fill="rgba(91,192,190,0.12)" stroke="#5BC0BE" strokeWidth="1" opacity="0.6"/>
    <circle cx="40" cy="40" r="2.5" fill="rgba(91,192,190,0.12)" stroke="#5BC0BE" strokeWidth="1" opacity="0.6"/>
    <line x1="16" y1="40" x2="28" y2="40" stroke="#5BC0BE" strokeWidth="1" opacity="0.4"/>
    <line x1="28" y1="40" x2="40" y2="40" stroke="#5BC0BE" strokeWidth="1" opacity="0.4"/>
  </svg>
);

const IconAlert = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M28 10 L44 38 L12 38 Z" stroke="#5BC0BE" strokeWidth="1.5" fill="rgba(91,192,190,0.07)" strokeLinejoin="round"/>
    <line x1="28" y1="21" x2="28" y2="30" stroke="#5BC0BE" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="28" cy="34" r="1.5" fill="#5BC0BE"/>
    <circle cx="44" cy="16" r="5" fill="rgba(91,192,190,0.12)" stroke="#5BC0BE" strokeWidth="1" opacity="0.5"/>
    <circle cx="14" cy="42" r="3.5" fill="rgba(91,192,190,0.08)" stroke="#5BC0BE" strokeWidth="1" opacity="0.4"/>
  </svg>
);

const features = [
  {
    Icon: IconRadar,
    eyebrow: '01',
    title: 'Monitoreo en Tiempo Real',
    description:
      'Visualización instantánea de variables meteorológicas y ambientales capturadas por sensores IoT distribuidos en más de 55 ciudades de Sudamérica.',
    tag: 'IoT · WebSocket',
    color: '#5BC0BE',
  },
  {
    Icon: IconAI,
    eyebrow: '02',
    title: 'Predicción con IA (NOAA)',
    description:
      'Análisis avanzado de datos geoespaciales GRIB2 del modelo GFS de la NOAA para generar pronósticos locales de alta precisión corregidos por bias local.',
    tag: 'GFS · GRIB2 · ML',
    color: '#3A9694',
  },
  {
    Icon: IconAlert,
    eyebrow: '03',
    title: 'Alertas Tempranas',
    description:
      'Sistema automatizado de notificaciones multicanal (WhatsApp, Telegram, Email) para mitigar riesgos climáticos antes de que ocurran.',
    tag: 'WhatsApp · Telegram',
    color: '#22C55E',
  },
];

const LandingFeatures = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="plataforma"
      ref={sectionRef}
      style={{
        padding: '7rem 2rem 6rem',
        background: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle background decoration */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        right: '-80px',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,192,190,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#5BC0BE',
            marginBottom: '0.75rem',
          }}>
            Nuestra Plataforma
          </p>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700',
            color: '#0B132B',
            letterSpacing: '-0.025em',
            lineHeight: '1.15',
            maxWidth: '560px',
            margin: '0 auto',
          }}>
            Llevar el análisis ambiental al siguiente nivel
          </h2>
        </div>

        {/* Feature cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
        }}>
          {features.map((feature, i) => (
            <div
              key={feature.title}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '2.5rem',
                borderRadius: '20px',
                background: '#FAFAFA',
                border: '1px solid #F0F0F0',
                transition: 'all 0.35s ease',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(30px)',
                transitionDelay: `${i * 120}ms`,
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 20px 60px rgba(91,192,190,0.12)';
                e.currentTarget.style.borderColor = 'rgba(91,192,190,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = visible ? 'translateY(0)' : 'translateY(30px)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#F0F0F0';
              }}
            >
              {/* Eyebrow number */}
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.72rem',
                fontWeight: '700',
                color: feature.color,
                letterSpacing: '0.1em',
                marginBottom: '1.25rem',
              }}>
                {feature.eyebrow}
              </span>

              {/* Geometric icon */}
              <div style={{ marginBottom: '1.75rem' }}>
                <feature.Icon />
              </div>

              {/* Title */}
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.15rem',
                fontWeight: '700',
                color: '#0B132B',
                letterSpacing: '-0.01em',
                marginBottom: '0.75rem',
              }}>
                {feature.title}
              </h3>

              {/* Description */}
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.9rem',
                color: '#6B7280',
                lineHeight: '1.7',
                marginBottom: '1.5rem',
                flex: 1,
              }}>
                {feature.description}
              </p>

              {/* Tag pill */}
              <span style={{
                display: 'inline-block',
                padding: '0.3rem 0.85rem',
                borderRadius: '100px',
                background: `${feature.color}14`,
                color: feature.color,
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.72rem',
                fontWeight: '600',
                letterSpacing: '0.05em',
              }}>
                {feature.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
