import React, { useEffect, useRef, useState } from 'react';

/**
 * LandingInterface — Sección de Mockup de la plataforma.
 * Llena el espacio en blanco con una vista espectacular y animada de cómo se ve el sistema por dentro.
 */
const LandingInterface = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '8rem 2rem',
        background: 'linear-gradient(to bottom, #F9FAFB, #FFFFFF)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', textAlign: 'center' }}>
        
        {/* Text Header */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          marginBottom: '4rem',
        }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700',
            color: '#0B132B',
            letterSpacing: '-0.02em',
            marginBottom: '1rem',
          }}>
            Toma el control desde un solo mapa
          </h2>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.1rem',
            color: '#6B7280',
            maxWidth: '600px',
            margin: '0 auto',
          }}>
            Interfaz inmersiva diseñada para la toma de decisiones críticas. Todo lo que necesitas saber, exactamente donde sucede.
          </p>
        </div>

        {/* Mockup Container */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1000px',
          height: '550px',
          margin: '0 auto',
          background: '#1C2541',
          borderRadius: '24px',
          boxShadow: '0 24px 80px rgba(11, 19, 43, 0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.95)',
          transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(91,192,190,0.15), transparent 60%)',
        }}>
          
          {/* Faux Map Lines */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(60deg) scale(2) translateY(-100px)',
            transformOrigin: 'top center',
          }} />

          {/* Floating UI Card 1 (Weather Data) */}
          <div style={{
            position: 'absolute',
            top: '15%',
            left: '10%',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '1.5rem',
            borderRadius: '16px',
            color: '#FFF',
            width: '240px',
            textAlign: 'left',
            fontFamily: "'Space Grotesk', sans-serif",
            animation: visible ? 'floatUI 6s ease-in-out infinite' : 'none',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#5BC0BE', fontWeight: '700', marginBottom: '0.5rem' }}>SANTA CRUZ, SCZ</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', lineHeight: 1 }}>32°C</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem' }}>Sensación térmica: 35°C</div>
            <div style={{ marginTop: '1rem', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
               <div style={{ width: '80%', height: '100%', background: '#F59E0B', borderRadius: '4px' }} />
            </div>
          </div>

          {/* Floating UI Card 2 (Alert) */}
          <div style={{
            position: 'absolute',
            bottom: '20%',
            right: '10%',
            background: 'rgba(239, 68, 68, 0.1)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '1.25rem',
            borderRadius: '16px',
            color: '#FFF',
            width: '260px',
            textAlign: 'left',
            fontFamily: "'Space Grotesk', sans-serif",
            animation: visible ? 'floatUI 7s ease-in-out infinite alternate-reverse' : 'none',
            boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#EF4444', borderRadius: '50%', boxShadow: '0 0 10px #EF4444' }} />
              <div style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: '700' }}>ALERTA TEMPRANA</div>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.25rem' }}>Probabilidad de Granizo</div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>Zona Norte (Sector Agrícola)</div>
          </div>

          {/* Glowing Map Point */}
          <div style={{
            position: 'absolute',
            width: '20px',
            height: '20px',
            background: '#5BC0BE',
            borderRadius: '50%',
            boxShadow: '0 0 30px 10px rgba(91,192,190,0.5)',
            animation: visible ? 'pulseMap 2s infinite' : 'none',
          }}>
            <div style={{
              position: 'absolute', inset: '-10px', border: '1px solid #5BC0BE', borderRadius: '50%', animation: 'ripple 2s infinite'
            }} />
          </div>

        </div>
      </div>

      <style>{`
        @keyframes floatUI {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pulseMap {
          0% { transform: scale(0.95); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(0.95); opacity: 1; }
        }
        @keyframes ripple {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </section>
  );
};

export default LandingInterface;
