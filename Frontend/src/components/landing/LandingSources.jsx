import React, { useEffect, useRef, useState } from 'react';

/**
 * LandingSources — Sección de Fuentes de Datos (Banda de confianza)
 * Muestra las fuentes científicas que respaldan la plataforma.
 */

const sources = [
  { name: 'NOAA NOMADS', desc: 'GFS Global Forecast System', icon: '🛰️' },
  { name: 'Open-Meteo', desc: 'Datos meteorológicos abiertos', icon: '🌡️' },
  { name: 'Open-Meteo AQI', desc: 'Calidad del aire global', icon: '💨' },
  { name: 'Sensores IoT', desc: 'Red propia de sensores locales', icon: '📡' },
  { name: 'TimescaleDB', desc: 'Base de datos de series temporales', icon: '📊' },
];

const LandingSources = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        padding: '4rem 2rem',
        background: '#FFFFFF',
        borderTop: '1px solid #F0F0F0',
        borderBottom: '1px solid #F0F0F0',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <p style={{
          textAlign: 'center',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.78rem',
          fontWeight: '600',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#9CA3AF',
          marginBottom: '2.5rem',
        }}>
          Fuentes de datos de grado científico y tecnología de respaldo
        </p>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '1rem',
        }}>
          {sources.map((s, i) => (
            <div
              key={s.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1.5rem',
                borderRadius: '12px',
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                transition: 'all 0.25s ease',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transitionDelay: `${i * 70}ms`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(91,192,190,0.4)';
                e.currentTarget.style.background = 'rgba(91,192,190,0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.background = '#F9FAFB';
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>{s.icon}</span>
              <div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  color: '#0B132B',
                }}>
                  {s.name}
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.72rem',
                  color: '#9CA3AF',
                }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingSources;
