import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const LandingHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Inicio', href: '#inicio' },
    { label: 'Plataforma', href: '#plataforma' },
    { label: 'Métricas', href: '#metricas' },
    { label: 'Contacto', href: '#contacto' },
  ];

  return (
    <header
      className="landing-header"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.3s ease',
        background: scrolled
          ? 'rgba(11, 19, 43, 0.92)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(91,192,190,0.15)' : '1px solid transparent',
        padding: '0 2rem',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo + Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <img
            src="/MeteoAdvance.png"
            alt="EnviroSense Logo"
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.35rem',
            fontWeight: '700',
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
          }}>
            Enviro<span style={{ color: '#5BC0BE' }}>Sense</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }} className="landing-desktop-nav">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                color: 'rgba(255,255,255,0.78)',
                textDecoration: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.95rem',
                fontWeight: '500',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={e => e.target.style.color = '#5BC0BE'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.78)'}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA Button */}
        <Link
          to="/login"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            padding: '0.6rem 1.5rem',
            borderRadius: '100px',
            background: '#5BC0BE',
            color: '#0B132B',
            fontWeight: '700',
            fontSize: '0.9rem',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
            letterSpacing: '0.01em',
            boxShadow: '0 0 20px rgba(91,192,190,0.35)',
          }}
          onMouseEnter={e => {
            e.target.style.background = '#6BE0DE';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 24px rgba(91,192,190,0.5)';
          }}
          onMouseLeave={e => {
            e.target.style.background = '#5BC0BE';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 0 20px rgba(91,192,190,0.35)';
          }}
        >
          Iniciar Sesión
        </Link>
      </div>
    </header>
  );
};

export default LandingHeader;
