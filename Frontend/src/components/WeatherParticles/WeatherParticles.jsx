import React, { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import './WeatherParticles.css';

const WeatherParticles = ({ isEnabled, weatherCode, currentZoom }) => {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  if (!isEnabled || !init) return null;

  let particleOptions = null;
  
  if ((weatherCode >= 51 && weatherCode <= 69) || (weatherCode >= 80 && weatherCode <= 82) || (weatherCode >= 95 && weatherCode <= 99)) {
    // Lluvia
    particleOptions = {
        particles: {
            color: { value: '#a0c4ff' },
            number: { value: 350 },
            shape: { type: 'circle' },
            stroke: { width: 1, color: '#0984e3' },
            size: { value: 1.5 },
            move: {
                enable: true,
                speed: 15,
                direction: 'bottom',
                straight: true
            },
            opacity: { value: 0.8 }
        }
    };
  } else if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
    // Nieve
    particleOptions = {
        particles: {
            color: { value: '#ffffff' },
            number: { value: 200 },
            shape: { type: 'circle' },
            stroke: { width: 1, color: '#0097e6' },
            size: { value: { min: 1, max: 2.5 } },
            move: {
                enable: true,
                speed: 2,
                direction: 'bottom',
                straight: false
            },
            opacity: { value: 0.9 }
        }
    };
  } else if (weatherCode === 45 || weatherCode === 48) {
    // Niebla
    particleOptions = {
        particles: {
            color: { value: '#b2bec3' },
            number: { value: 80 },
            shape: { type: 'circle' },
            size: { value: { min: 8, max: 20 } },
            move: {
                enable: true,
                speed: 0.5,
                direction: 'right',
                straight: false
            },
            opacity: { value: 0.3 }
        }
    };
  } else {
    // Despejado o Null
    particleOptions = {
        particles: {
            color: { value: '#ffeaa7' },
            number: { value: 150 },
            shape: { type: 'circle' },
            stroke: { width: 0.5, color: '#e17055' },
            size: { value: { min: 1.5, max: 2.5 } },
            move: {
                enable: true,
                speed: 1,
                direction: 'none',
                random: true
            },
            opacity: { value: 0.8 }
        }
    };
  }

  return (
    <Particles
      key={weatherCode}
      id={`tsparticles-${weatherCode}`}
      className="weather-particles-container"
      options={{
        ...particleOptions,
        fullScreen: { enable: false },
        background: { color: { value: 'transparent' } },
        fpsLimit: 60,
        detectRetina: false,
        interactivity: { events: { onClick: { enable: false }, onHover: { enable: false } } }
      }}
    />
  );
};

export default WeatherParticles;
