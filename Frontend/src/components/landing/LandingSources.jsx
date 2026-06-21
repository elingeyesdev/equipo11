import React, { useEffect, useRef, useState } from 'react';

/**
 * LandingSources — Sección de Fuentes de Datos (Banda de confianza)
 * Muestra las fuentes científicas que respaldan la plataforma.
 */

// Íconos vectoriales personalizados
const IconSatellite = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5BC0BE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 7l4 4"/>
    <path d="m17 11 5-5-4-4-5 5"/>
    <path d="m3 21 6-6"/>
    <path d="M7 11l4 4"/>
    <path d="m11 17-5 5-4-4 5-5"/>
    <path d="M11 13 7 9"/>
  </svg>
);

const IconThermometer = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
  </svg>
);

const IconWind = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.8 19.6A2 2 0 1 0 14 16H2"/>
    <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/>
    <path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>
  </svg>
);

const IconRadar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12v9"/>
    <path d="M19 8c-1.5-1.5-3.5-2.5-5.5-2.5S9.5 6.5 8 8"/>
    <path d="M22 5c-2.5-2.5-6-4-10-4S4.5 2.5 2 5"/>
    <path d="M12 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
  </svg>
);

const IconDatabase = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
    <path d="M3 12A9 3 0 0 0 21 12"/>
  </svg>
);

const sources = [
  { name: 'NOAA NOMADS', desc: 'GFS Global Forecast System', icon: <IconSatellite /> },
  { name: 'Open-Meteo', desc: 'Datos meteorológicos abiertos', icon: <IconThermometer /> },
  { name: 'Open-Meteo AQI', desc: 'Calidad del aire global', icon: <IconWind /> },
  { name: 'Sensores IoT', desc: 'Red propia de sensores locales', icon: <IconRadar /> },
  { name: 'TimescaleDB', desc: 'Base de datos de series temporales', icon: <IconDatabase /> },
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
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
