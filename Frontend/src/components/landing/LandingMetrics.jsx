import React, { useEffect, useRef, useState } from 'react';

/**
 * LandingMetrics — Sección 3 "Métricas PWA"
 * Fondo oscuro con las 4 métricas estáticas del sistema mostradas de forma visual.
 * Estilo inspirado en la sección "Cifras que nos respaldan" del template Wix.
 */

/* Clean inline SVG icons for each metric */
const ThermometerIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
  </svg>
);

const HumidityIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22a5 5 0 0 0 5-5c0-2-2.5-7-5-11-2.5 4-5 9-5 11a5 5 0 0 0 5 5z"/>
  </svg>
);

const AirQualityIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2"/>
    <path d="M10.59 15.41A2 2 0 1 0 12 19H2"/>
    <path d="M15.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/>
  </svg>
);

const WindIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
  </svg>
);

const metrics = [
  {
    Icon: ThermometerIcon,
    value: '24°C',
    label: 'Temperatura',
    sublabel: 'Santa Cruz, Bolivia',
    color: '#F59E0B',
    status: 'Normal',
    statusColor: '#22C55E',
    bar: 60,
  },
  {
    Icon: HumidityIcon,
    value: '68%',
    label: 'Humedad Relativa',
    sublabel: 'Medida local',
    color: '#5BC0BE',
    status: 'Moderado',
    statusColor: '#5BC0BE',
    bar: 68,
  },
  {
    Icon: AirQualityIcon,
    value: 'AQI 42',
    label: 'Calidad del Aire',
    sublabel: 'Índice ICA',
    color: '#22C55E',
    status: 'Bueno',
    statusColor: '#22C55E',
    bar: 42,
  },
  {
    Icon: WindIcon,
    value: '18 km/h',
    label: 'Velocidad del Viento',
    sublabel: 'Dirección NE',
    color: '#8B5CF6',
    status: 'Brisa suave',
    statusColor: '#8B5CF6',
    bar: 30,
  },
];

const LandingMetrics = () => {
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
      id="metricas"
      ref={sectionRef}
      style={{
        padding: '6rem 2rem',
        background: 'linear-gradient(135deg, #0B132B 0%, #1C2541 50%, #0B132B 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decorations */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '700px',
        height: '700px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,192,190,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#5BC0BE',
            marginBottom: '0.75rem',
          }}>
            Vista Previa · PWA
          </p>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)',
            fontWeight: '700',
            color: '#FFFFFF',
            letterSpacing: '-0.025em',
            lineHeight: '1.2',
          }}>
            Variables ambientales que monitoreamos
          </h2>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1rem',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '0.75rem',
          }}>
            Inicia sesión para acceder a datos en vivo de tu ubicación
          </p>
        </div>

        {/* Metrics grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
        }}>
          {metrics.map((metric, i) => (
            <div
              key={metric.label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '2rem',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.35s ease',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transitionDelay: `${i * 100}ms`,
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                e.currentTarget.style.borderColor = `${metric.color}40`;
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 16px 48px ${metric.color}18`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = visible ? 'translateY(0)' : 'translateY(24px)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Icon */}
              <div style={{
                color: metric.color,
                marginBottom: '1.25rem',
                opacity: 0.9,
              }}>
                <metric.Icon />
              </div>

              {/* Value */}
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '2.4rem',
                fontWeight: '700',
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                lineHeight: '1',
                marginBottom: '0.4rem',
              }}>
                {metric.value}
              </div>

              {/* Label */}
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.9rem',
                fontWeight: '600',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '0.25rem',
              }}>
                {metric.label}
              </div>

              {/* Sublabel */}
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: '1.5rem',
              }}>
                {metric.sublabel}
              </div>

              {/* Progress bar */}
              <div style={{
                height: '3px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '100px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: visible ? `${metric.bar}%` : '0%',
                  background: `linear-gradient(90deg, ${metric.color}, ${metric.color}88)`,
                  borderRadius: '100px',
                  transition: `width 1.2s ease ${i * 100 + 300}ms`,
                }} />
              </div>

              {/* Status tag */}
              <div style={{
                marginTop: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: metric.statusColor,
                  display: 'inline-block',
                }} />
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  color: metric.statusColor,
                }}>
                  {metric.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA below metrics */}
        <div style={{
          textAlign: 'center',
          marginTop: '3rem',
          padding: '1.75rem 2rem',
          background: 'rgba(91,192,190,0.08)',
          border: '1px solid rgba(91,192,190,0.2)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: '#FFFFFF',
              fontWeight: '600',
              fontSize: '1rem',
              marginBottom: '0.2rem',
            }}>
              ¿Listo para acceder a datos en tiempo real?
            </p>
            <p style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.85rem',
            }}>
              Inicia sesión y explora el mapa interactivo con datos vivos.
            </p>
          </div>
          <a
            href="/login"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.75rem',
              borderRadius: '100px',
              background: '#5BC0BE',
              color: '#0B132B',
              fontWeight: '700',
              fontSize: '0.9rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(91,192,190,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Acceder al Sistema →
          </a>
        </div>
      </div>
    </section>
  );
};

export default LandingMetrics;
