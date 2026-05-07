import { useMemo, useEffect, useRef } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';

const getWeatherType = (code) => {
  if (code == null || code === 0) return null;
  // Lluvia
  if ((code >= 51 && code <= 69) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
  // Nieve
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  // Niebla
  if (code === 45 || code === 48) return 'fog';
  return null;
};

const getWeatherColor = (type) => {
  if (type === 'rain') return '#3b82f6';
  if (type === 'snow') return '#ffffff';
  if (type === 'fog') return '#9ca3af';
  if (type === 'wind') return '#a7f3d0';
  return null;
};

const GridRadarLayer = ({ scannedGrid, currentZoom = 6, particleFilters = { rain: true, snow: true, wind: true, fog: true } }) => {
  const { current: map } = useMap();
  const canvasRef = useRef(null);

  const { geojson, activeNodes } = useMemo(() => {
    const features = [];
    const nodes = [];
    
    if (scannedGrid && scannedGrid.length > 0) {
      scannedGrid.forEach((cell, index) => {
        let type = getWeatherType(cell.weather_code);
        
        // Si no hay lluvia/nieve/niebla, pero hay mucho viento, lo marcamos como viento
        if (!type && cell.wind_speed > 15) {
          type = 'wind';
        }

        if (type && cell.latitud && cell.longitud && particleFilters[type] !== false) {
          features.push({
            type: 'Feature',
            properties: { color: getWeatherColor(type) },
            geometry: {
              type: 'Point',
              coordinates: [cell.longitud, cell.latitud]
            }
          });
          
          nodes.push({
            id: index,
            longitude: cell.longitud,
            latitude: cell.latitud,
            type: type,
            direction: cell.wind_direction || 0,
            wind_speed: cell.wind_speed || 0,
            presion: cell.presion || 1013,
            rafagas: cell.rafagas || 0
          });
        }
      });
    }
    
    return {
      geojson: { type: 'FeatureCollection', features },
      activeNodes: nodes
    };
  }, [scannedGrid, particleFilters]);

  const organicLayer = {
    id: 'radar-organic-layer',
    type: 'circle',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 15,
        6, 50,
        9, 200,
        12, 600
      ],
      'circle-blur': 2.0,
      'circle-opacity': 0.0 
    }
  };

  // Motor de renderizado Canvas
  useEffect(() => {
    if (!map || !canvasRef.current || activeNodes.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    let animationId;
    let lastTime = performance.now();
    
    const PARTICLES_PER_NODE = 10; 
    let particles = [];
    
    const initParticles = () => {
      particles = [];
      const currentMapZoom = map.getZoom();
      // El radio base escala con el zoom.
      const baseRadius = Math.max(5, 40 * Math.pow(2, currentMapZoom - 6));
      
      activeNodes.forEach(node => {
        const particleCount = node.type === 'wind' ? 4 : PARTICLES_PER_NODE;
        for (let i = 0; i < particleCount; i++) {
          particles.push({
            node,
            offsetX: (Math.random() - 0.5) * baseRadius * 2,
            offsetY: (Math.random() - 0.5) * baseRadius * 2,
            speed: Math.random() * 0.5 + 0.5,
            phase: Math.random() * Math.PI * 2,
            life: Math.random(),
            baseRadius
          });
        }
      });
    };
    
    const updateSize = () => {
      const container = map.getContainer();
      // Multiplicar por pixelRatio para pantallas retina
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * pixelRatio;
      canvas.height = container.clientHeight * pixelRatio;
      ctx.scale(pixelRatio, pixelRatio);
    };
    
    const render = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1); 
      lastTime = time;
      const currentMapZoom = map.getZoom();
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const bounds = map.getBounds();
      const boundN = bounds.getNorth() + 2;
      const boundS = bounds.getSouth() - 2;
      const boundE = bounds.getEast() + 2;
      const boundW = bounds.getWest() - 2;
      
      // Cache the projected positions for this frame to avoid calling map.project 23,000 times
      const nodeProjections = new Map();

      particles.forEach(p => {
        const { longitude, latitude, type, direction, wind_speed, presion, rafagas } = p.node;
        
        if (longitude < boundW || longitude > boundE ||
            latitude < boundS || latitude > boundN) {
            return;
        }

        let pixelPos = nodeProjections.get(p.node.id);
        if (!pixelPos) {
          pixelPos = map.project([longitude, latitude]);
          nodeProjections.set(p.node.id, pixelPos);
        }

        const x = pixelPos.x + p.offsetX;
        const y = pixelPos.y + p.offsetY;
        
        ctx.beginPath();
        
        if (type === 'rain') {
          // Velocidad relativa al radio para que se vea igual sin importar el zoom
          p.offsetY += (p.baseRadius * 4) * p.speed * dt;
          if (p.offsetY > p.baseRadius) { 
            p.offsetY = -p.baseRadius; 
            p.offsetX = (Math.random() - 0.5) * p.baseRadius * 2; 
          }
          
          ctx.moveTo(x, y);
          
          // La longitud y el grosor de las gotas de lluvia ahora escalan con el zoom
          const zoomFactor = Math.max(0.2, currentMapZoom / 6);
          const dropLength = 20 * zoomFactor;
          const dropWidth = 5 * zoomFactor;
          
          ctx.lineTo(x - dropWidth, y + dropLength); // Lluvia inclinada
          const opacity = Math.max(0, 0.7 - Math.abs(p.offsetY) / p.baseRadius);
          ctx.strokeStyle = `rgba(50, 130, 255, ${opacity})`;
          // Líneas más finas al alejar la cámara
          ctx.lineWidth = Math.max(0.5, 1.5 * zoomFactor);
          ctx.lineCap = 'round';
          ctx.stroke();
          
        } else if (type === 'snow') {
          p.offsetY += (p.baseRadius * 0.8) * p.speed * dt;
          p.offsetX += Math.sin(time / 800 + p.phase) * (p.baseRadius * 0.02);
          if (p.offsetY > p.baseRadius) { 
            p.offsetY = -p.baseRadius; 
          }
          
          const zoomFactor = Math.max(0.2, currentMapZoom / 6);
          const snowRadius = Math.max(0.5, (2 * p.speed + 1) * zoomFactor);
          
          ctx.arc(x, y, snowRadius, 0, Math.PI * 2);
          const opacity = Math.max(0, 0.8 - Math.abs(p.offsetY) / p.baseRadius);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fill();
          
        } else if (type === 'wind') {
          const angleRad = (direction - 90) * Math.PI / 180;
          
          // Velocidad proporcional al viento real de la API y al nivel de zoom
          const windIntensity = Math.max(15, wind_speed) / 20; // 20km/h = 1x, 60km/h = 3x
          const velocity = (p.baseRadius * 2.5) * p.speed * windIntensity;
          
          p.offsetX += Math.cos(angleRad) * velocity * dt;
          p.offsetY += Math.sin(angleRad) * velocity * dt;
          
          // Factor de zoom
          const zoomFactor = Math.max(0.2, currentMapZoom / 6);

          // Al hacer zoom out (zoomFactor pequeño), dividimos la duración de vida para que mueran más rápido
          p.life -= dt * (0.5 + p.speed * 0.3) / zoomFactor;
          
          if (p.life <= 0) {
            p.life = 1;
            // Respawn cerca del centro del nodo para evitar que crucen a otras áreas
            p.offsetX = (Math.random() - 0.5) * p.baseRadius * 1.2;
            p.offsetY = (Math.random() - 0.5) * p.baseRadius * 1.2;
          }
          
          // Longitud de la línea de viento más corta, además se hace ultra-corta al hacer zoom out
          const length = (8 + (p.speed * 4)) * zoomFactor;
          const tailX = x - Math.cos(angleRad) * length;
          const tailY = y - Math.sin(angleRad) * length;
          
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(x, y);
          
          // Detección de Huracanes / Tormentas Severas
          // Si las ráfagas superan 90km/h o la presión es muy baja (<990 hPa), pintamos de Púrpura/Rojo
          let strokeColor = `rgba(180, 230, 255, ${fade * 0.5})`; // Viento normal (Azul claro)
          
          if (rafagas > 90 || presion < 990) {
            strokeColor = `rgba(220, 20, 150, ${fade * 0.8})`; // Rojo/Púrpura agresivo (Huracán)
            ctx.lineWidth = 2.5; // Más grueso para resaltar el peligro
          } else if (rafagas > 60 || presion < 1005) {
            strokeColor = `rgba(255, 140, 0, ${fade * 0.6})`; // Naranja (Tormenta Tropical / Fuerte)
            ctx.lineWidth = 2.0;
          } else {
            ctx.lineWidth = 1.8;
          }
          
          ctx.strokeStyle = strokeColor;
          ctx.lineCap = 'round';
          ctx.stroke();
          
        } else if (type === 'fog') {
          p.offsetX += Math.sin(time / 1500 + p.phase) * (p.baseRadius * 0.01);
          ctx.arc(x, y, 40 * p.speed, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(200, 200, 200, 0.05)';
          ctx.fill();
        }
      });
      
      animationId = requestAnimationFrame(render);
    };
    
    map.on('resize', updateSize);
    updateSize();
    initParticles();
    animationId = requestAnimationFrame(render);
    
    // Reiniciar posiciones al cambiar zoom abruptamente
    const onZoom = () => { initParticles(); };
    map.on('zoomend', onZoom);
    
    return () => {
      cancelAnimationFrame(animationId);
      map.off('resize', updateSize);
      map.off('zoomend', onZoom);
    };
  }, [map, activeNodes]);

  return (
    <>
      <Source id="radar-organic-source" type="geojson" data={geojson}>
        <Layer {...organicLayer} />
      </Source>
      
      <canvas 
        ref={canvasRef} 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 5
        }} 
      />
    </>
  );
};

export default GridRadarLayer;
