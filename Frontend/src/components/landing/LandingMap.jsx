import React, { useEffect, useRef, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * LandingMap — Mapa real de Mapbox enfocado en Sudamérica.
 * Muestra marcadores estáticos de sensores como demostración de la plataforma.
 */

// Puntos de sensores simulados en Sudamérica
const sensorPoints = [
  { lat: -17.7833, lng: -63.1821, name: 'Santa Cruz' },
  { lat: -16.5000, lng: -68.1193, name: 'La Paz' },
  { lat: -17.3895, lng: -66.1568, name: 'Cochabamba' },
  { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires' },
  { lat: -23.5505, lng: -46.6333, name: 'São Paulo' },
  { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
  { lat: -12.0464, lng: -77.0428, name: 'Lima' },
  { lat: 4.6097,   lng: -74.0817, name: 'Bogotá' },
  { lat: -0.1807,  lng: -78.4678, name: 'Quito' },
  { lat: 10.4806,  lng: -66.9036, name: 'Caracas' },
];

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''; 

const LandingMap = () => {
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
        padding: '6rem 2rem',
        background: 'linear-gradient(to bottom, #FFFFFF, #F9FAFB)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', textAlign: 'center' }}>
        
        {/* Header Text */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          marginBottom: '3rem',
        }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700',
            color: '#0B132B',
            letterSpacing: '-0.02em',
            marginBottom: '1rem',
          }}>
            Cobertura a nivel continental
          </h2>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.1rem',
            color: '#6B7280',
            maxWidth: '600px',
            margin: '0 auto',
          }}>
            Explora nuestra red de sensores distribuidos estratégicamente por Sudamérica.
          </p>
        </div>

        {/* Mapbox Container */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '500px',
          margin: '0 auto',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(11, 19, 43, 0.15)',
          border: '1px solid #E5E7EB',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.98)',
          transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
        }}>
          {MAPBOX_TOKEN ? (
            <Map
              initialViewState={{
                longitude: -60.0,
                latitude: -15.0,
                zoom: 3,
                pitch: 45,
                bearing: -15,
              }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              mapboxAccessToken={MAPBOX_TOKEN}
              interactive={false} // Mantener estático como solicitaste
              style={{ width: '100%', height: '100%' }}
            >
              {sensorPoints.map((pt, index) => (
                <Marker key={index} longitude={pt.lng} latitude={pt.lat} anchor="center">
                  <div style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#5BC0BE',
                    borderRadius: '50%',
                    boxShadow: '0 0 15px 4px rgba(91,192,190,0.6)',
                    cursor: 'pointer',
                    animation: `pulseMap 2s infinite ${index * 0.2}s`,
                  }} title={pt.name}>
                    <div style={{
                      position: 'absolute',
                      inset: '-6px',
                      border: '2px solid rgba(91,192,190,0.5)',
                      borderRadius: '50%',
                      animation: `ripple 2s infinite ${index * 0.2}s`,
                    }} />
                  </div>
                </Marker>
              ))}
            </Map>
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1C2541', color: '#5BC0BE',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              Configura VITE_MAPBOX_TOKEN en tu .env para ver el mapa
            </div>
          )}
          
          {/* Faux Interface Overlay */}
          <div style={{
            position: 'absolute',
            top: '20px', left: '20px',
            background: 'rgba(11,19,43,0.85)',
            backdropFilter: 'blur(8px)',
            padding: '1rem',
            borderRadius: '12px',
            color: '#FFF',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: "'Space Grotesk', sans-serif",
            textAlign: 'left'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#5BC0BE', fontWeight: '700' }}>ESTADO DE LA RED</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', marginTop: '0.2rem' }}>10 Sensores Activos</div>
            <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '0.2rem' }}>Sudamérica</div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulseMap {
          0% { transform: scale(0.85); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
          100% { transform: scale(0.85); opacity: 1; }
        }
        @keyframes ripple {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </section>
  );
};

export default LandingMap;
