import React, { useEffect, useRef, useState } from 'react';

/**
 * LandingWhy — Sección "¿Por qué MeteoroAdvanced?"
 * Sección adicional que explica el propósito y valor del sistema.
 */

const reasons = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    title: 'Datos de Grado Científico',
    text: 'Integramos fuentes certificadas como NOAA NOMADS y Open-Meteo para garantizar precisión en cada lectura. Sin datos estimados, solo ciencia.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Alertas que Salvan Vidas',
    text: 'Las alertas tempranas automatizadas permiten a comunidades y gobiernos actuar antes de que eventos climáticos extremos causen daño.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    title: 'Accesible desde cualquier dispositivo',
    text: 'La plataforma funciona como PWA instalable en móviles, tablets y escritorio. Lleva el monitoreo en tu bolsillo donde vayas.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'Predicciones con IA local',
    text: 'El modelo de corrección de bias combina datos satelitales globales con lecturas locales para pronósticos hiperlocales más precisos que nunca.',
  },
];

const LandingWhy = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '7rem 2rem',
        background: '#F9FAFB',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        bottom: '-100px',
        left: '-100px',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,192,190,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '4rem',
          alignItems: 'center',
        }}>
          {/* Left column — text */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : 'translateX(-30px)',
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
              ¿Por qué nosotros?
            </p>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: '700',
              color: '#0B132B',
              letterSpacing: '-0.025em',
              lineHeight: '1.15',
              marginBottom: '1.5rem',
            }}>
              Un sistema construido para proteger
            </h2>
            <p style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1rem',
              color: '#6B7280',
              lineHeight: '1.75',
              maxWidth: '420px',
            }}>
              MeteoroAdvanced nació de la necesidad de democratizar el acceso a datos ambientales de calidad en Bolivia y Sudamérica. Combinamos tecnología de clase mundial con sensibilidad local para generar valor real en comunidades, investigadores y tomadores de decisiones.
            </p>

            {/* Stats strip */}
            <div style={{
              display: 'flex',
              gap: '2rem',
              marginTop: '2.5rem',
              paddingTop: '2rem',
              borderTop: '1px solid #E5E7EB',
              flexWrap: 'wrap',
            }}>
              {[
                { value: '55+', label: 'Ciudades' },
                { value: '11', label: 'Variables NOAA' },
                { value: '24/7', label: 'Monitoreo' },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '2rem',
                    fontWeight: '700',
                    color: '#0B132B',
                    letterSpacing: '-0.02em',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.8rem',
                    color: '#9CA3AF',
                    fontWeight: '500',
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — reason cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
          }}>
            {reasons.map((r, i) => (
              <div
                key={r.title}
                style={{
                  padding: '1.5rem',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  transition: 'all 0.3s ease',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: `${i * 80 + 200}ms`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(91,192,190,0.4)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(91,192,190,0.1)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ color: '#5BC0BE', marginBottom: '0.75rem' }}>
                  {r.icon}
                </div>
                <h4 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  color: '#0B132B',
                  marginBottom: '0.5rem',
                  letterSpacing: '-0.01em',
                }}>
                  {r.title}
                </h4>
                <p style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.8rem',
                  color: '#6B7280',
                  lineHeight: '1.65',
                }}>
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingWhy;
