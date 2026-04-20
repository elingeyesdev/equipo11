import { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadFull } from 'tsparticles';
import './WeatherParticles.css';

const WeatherParticles = ({ isEnabled, weatherCode }) => {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  // Return null if disabled, not initialized, or no weather code
  if (!isEnabled || !init || weatherCode === null || weatherCode === undefined) return null;

  // WMO codes:
  // 0-3: Clear to overcast
  // 45-48: Fog
  // 51-69: Rain/Drizzle
  // 71-77: Snow
  // 80-82: Rain showers
  // 85-86: Snow showers
  // 95-99: Thunderstorm
  
  let particleOptions = null;
  
  if ((weatherCode >= 51 && weatherCode <= 69) || (weatherCode >= 80 && weatherCode <= 82) || (weatherCode >= 95 && weatherCode <= 99)) {
    // Lluvia
    particleOptions = {
        particles: {
            color: { value: '#a0c4ff' },
            number: { value: 150 },
            shape: { type: 'line' },
            size: { value: { min: 10, max: 20 } },
            move: {
                enable: true,
                speed: 25,
                direction: 'bottom',
                straight: true,
            },
            opacity: { value: 0.6 }
        }
    };
  } else if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
    // Nieve
    particleOptions = {
        particles: {
            color: { value: '#ffffff' },
            number: { value: 100 },
            shape: { type: 'circle' },
            size: { value: { min: 2, max: 4 } },
            move: {
                enable: true,
                speed: 3,
                direction: 'bottom',
                straight: false,
            },
            opacity: { value: 0.8 }
        }
    };
  } else if (weatherCode === 45 || weatherCode === 48) {
    // Niebla / Bruma
    particleOptions = {
        particles: {
            color: { value: '#dddddd' },
            number: { value: 40 },
            shape: { type: 'circle' },
            size: { value: { min: 20, max: 60 } },
            move: {
                enable: true,
                speed: 1,
                direction: 'right',
                straight: false,
            },
            opacity: { value: { min: 0.05, max: 0.15 } }
        }
    };
  }

  // Si está despejado (0-3), no mostramos partículas
  if (!particleOptions) return null;

  return (
    <div className="weather-particles-container">
      <Particles
        id="tsparticles"
        options={{
          ...particleOptions,
          background: { color: { value: 'transparent' } },
          detectRetina: true,
          interactivity: { events: { onClick: { enable: false }, onHover: { enable: false } } }
        }}
      />
    </div>
  );
};

export default WeatherParticles;
