import React, { useEffect, useRef, useState } from 'react';

/**
 * LandingUseCases — Sección "Casos de Uso"
 * Llena el espacio en blanco antes del CTA mostrando a quién beneficia el sistema.
 */

// Íconos SVG para los casos de uso
const IconAgriculture = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </svg>
);

const IconGovernment = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22h16"/>
    <path d="M4 2v20"/>
    <path d="M20 2v20"/>
    <path d="M10 22V10h4v12"/>
    <path d="M4 6h16"/>
    <path d="M4 14h16"/>
    <path d="M4 10h16"/>
    <path d="M4 18h16"/>
  </svg>
);

const IconResearch = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="m19 9-5 5-4-4-3 3"/>
    <path d="M14 9h5v5"/>
  </svg>
);

const cases = [
  {
    icon: IconAgriculture,
    title: 'Sector Agrícola',
    description: 'Prevé heladas y sequías. Optimiza el riego y protege las cosechas anticipándote a condiciones climáticas adversas con alertas locales.',
    color: '#22C55E', // Moss green
  },
  {
    icon: IconGovernment,
    title: 'Gobiernos y Municipios',
    description: 'Gestiona riesgos de salud pública monitoreando la calidad del aire (ICA) y despliega operativos de emergencia antes de eventos climáticos severos.',
    color: '#3B82F6', // River blue
  },
  {
    icon: IconResearch,
    title: 'Instituciones e Investigadores',
    description: 'Accede a un vasto registro histórico de series temporales ambientales. Cruza datos de sensores locales con los modelos globales de la NOAA.',
    color: '#8B5CF6', // Violet
  },
];

const LandingUseCases = () => {
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
      ref={sectionRef}
      style={{
        padding: '7rem 2rem',
        background: '#FFFFFF', // Blanco sólido para contrastar con LandingWhy y LandingCTA
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '5rem',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s ease',
        }}>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#5BC0BE',
            marginBottom: '0.75rem',
          }}>
            ¿Para quién está diseñado?
          </p>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700',
            color: '#0B132B',
            letterSpacing: '-0.025em',
            lineHeight: '1.15',
          }}>
            Soluciones reales para problemas críticos
          </h2>
        </div>

        {/* Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2.5rem',
        }}>
          {cases.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #F0F0F0',
                  borderRadius: '24px',
                  padding: '3rem 2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  transition: 'all 0.4s ease',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(40px)',
                  transitionDelay: `${i * 150}ms`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = `0 20px 40px ${c.color}15`;
                  e.currentTarget.style.borderColor = `${c.color}50`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#F0F0F0';
                }}
              >
                {/* Icon Container */}
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  background: `${c.color}15`,
                  color: c.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '2rem',
                }}>
                  <Icon />
                </div>

                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#0B132B',
                  marginBottom: '1rem',
                  letterSpacing: '-0.01em',
                }}>
                  {c.title}
                </h3>

                <p style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.95rem',
                  color: '#6B7280',
                  lineHeight: '1.65',
                }}>
                  {c.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default LandingUseCases;
