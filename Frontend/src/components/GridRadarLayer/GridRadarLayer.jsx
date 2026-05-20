import { useMemo, useEffect, useRef } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';

const getWeatherType = (cell) => {
  if (!cell) return null;
  const code = cell.weather_code;
  
  // Si tenemos CAPE y REFC altos, es tormenta eléctrica
  if (cell.cape > 1000 && cell.refc > 35) return 'thunderstorm';
  // Si tenemos CAPE alto y HLCY (Helicidad) alto, es advertencia de tornado
  if (cell.cape > 1000 && cell.hlcy > 150) return 'tornado_warning';

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
  if (type === 'thunderstorm') return '#fbbf24'; // Amarillo rayo
  if (type === 'tornado_warning') return '#9333ea'; // Púrpura tornado
  return null;
};

const GridRadarLayer = ({ scannedGrid, currentZoom = 6, particleFilters = { rain: true, snow: true, wind: true, fog: true, thunderstorm: true, tornado_warning: true } }) => {
  const { current: map } = useMap();
  const canvasRef = useRef(null);

  const { geojson, activeNodes } = useMemo(() => {
    const features = [];
    const nodes = [];
    
    if (scannedGrid && scannedGrid.length > 0) {
      scannedGrid.forEach((cell, index) => {
        let type = getWeatherType(cell);
        
        let isTypeEnabled = particleFilters[type];
        if (type === 'thunderstorm') isTypeEnabled = particleFilters.rain;
        if (type === 'tornado_warning') isTypeEnabled = particleFilters.wind;

        // Si el tipo actual está desactivado en los filtros, intentamos caer en "wind" si hay viento
        if (type && isTypeEnabled === false) {
          type = null;
        }

        // Si no hay lluvia/nieve/niebla activa, pero hay viento fuerte, y el filtro de viento está activo
        if (!type && cell.wind_speed > 15 && particleFilters.wind !== false) {
          type = 'wind';
          isTypeEnabled = particleFilters.wind;
        }

        if (type && cell.latitud && cell.longitud && isTypeEnabled !== false) {
          features.push({
            type: 'Feature',
            properties: { 
              color: getWeatherColor(type),
              wind_speed: cell.wind_speed || 0
            },
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
    if (!map || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    
    let animationId;
    let lastTime = performance.now();
    let particles = [];
    let visibleNodes = [];

    // Función para filtrar qué nodos están en el viewport
    const updateVisibleNodes = () => {
      if (!map) return;
      const bounds = map.getBounds();
      const buffer = 1.0; // 1 grado de margen
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      visibleNodes = activeNodes.filter(node => 
        node.latitude >= sw.lat - buffer && node.latitude <= ne.lat + buffer &&
        node.longitude >= sw.lng - buffer && node.longitude <= ne.lng + buffer
      );

      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const currentMapZoom = map.getZoom();
      const baseRadius = Math.max(5, 40 * Math.pow(2, currentMapZoom - 6));
      
      visibleNodes.forEach(node => {
        let pCount = currentMapZoom > 5 ? (node.type === 'wind' ? 4 : 10) : (currentMapZoom > 3 ? 2 : 1);
        if (node.type === 'thunderstorm' || node.type === 'tornado_warning') pCount = currentMapZoom > 5 ? 3 : 1;
        
        // Reducir masivamente la densidad de partículas al hacer zoom out para mantener un rendimiento alto
        if (currentMapZoom < 4 && Math.random() > 0.4) pCount = 0; 

        for (let i = 0; i < pCount; i++) {
          particles.push({
            node,
            offsetX: (Math.random() - 0.5) * baseRadius * 2,
            offsetY: (Math.random() - 0.5) * baseRadius * 2,
            speed: Math.random() * 0.5 + 0.5,
            phase: Math.random() * Math.PI * 2,
            life: Math.random(),
            baseRadius,
            flashTimer: Math.random() * 50 // Para relámpagos
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
      
      const nodeProjections = new Map();

      // Calcular el worldWidth para el mapa infinito una sola vez
      let worldWidth = 0;
      if (currentMapZoom < 4) {
         let rightPos = map.project([360, 0]);
         let centerPos = map.project([0, 0]);
         worldWidth = Math.abs(rightPos.x - centerPos.x);
      }
      const offsets = worldWidth > 0 ? [0, -worldWidth, worldWidth] : [0];

      // ACTUALIZACIÓN DE FÍSICA
      particles.forEach(p => {
        const { type, direction, wind_speed } = p.node;
        
        if (type === 'rain') {
          p.offsetY += (p.baseRadius * 4) * p.speed * dt;
          if (p.offsetY > p.baseRadius) { 
            p.offsetY = -p.baseRadius; 
            p.offsetX = (Math.random() - 0.5) * p.baseRadius * 2; 
          }
        } else if (type === 'snow') {
          p.offsetY += (p.baseRadius * 0.8) * p.speed * dt;
          p.offsetX += Math.sin(time / 800 + p.phase) * (p.baseRadius * 0.02);
          if (p.offsetY > p.baseRadius) { 
            p.offsetY = -p.baseRadius; 
          }
        } else if (type === 'wind') {
          const angleRad = (direction - 90) * Math.PI / 180;
          
          const windIntensity = Math.max(15, wind_speed) / 20;
          const velocity = (p.baseRadius * 2.5) * p.speed * windIntensity;
          
          p.offsetX += Math.cos(angleRad) * velocity * dt;
          p.offsetY += Math.sin(angleRad) * velocity * dt;
          
          const zoomFactor = Math.max(0.2, currentMapZoom / 6);
          p.life -= dt * (0.5 + p.speed * 0.3) / zoomFactor;
          
          if (p.life <= 0) {
            p.life = 1;
            p.offsetX = (Math.random() - 0.5) * p.baseRadius * 1.2;
            p.offsetY = (Math.random() - 0.5) * p.baseRadius * 1.2;
          }
        } else if (type === 'thunderstorm') {
          p.flashTimer += dt;
          if (!p.lightningForks || p.flashTimer > 3.0) {
             p.flashTimer = 0;
             p.lightningForks = [];
             for(let k=0; k<2; k++) {
               let lx = (Math.random() - 0.5) * p.baseRadius;
               let ly = -p.baseRadius * 0.5;
               let path = [[lx, ly]];
               for(let j=0; j<4; j++) {
                  lx += (Math.random() - 0.5) * 15;
                  ly += Math.random() * 15;
                  path.push([lx, ly]);
               }
               p.lightningForks.push(path);
             }
          }
        } else if (type === 'tornado_warning') {
          p.phase += dt * 5 * p.speed; 
          p.life -= dt * 0.5;
          if (p.life <= 0) p.life = 1;
        } else if (type === 'fog') {
          p.offsetX += Math.sin(time / 1500 + p.phase) * (p.baseRadius * 0.01);
        }
      });

      const drawParticle = (p, isThunderstormPass) => {
        const { longitude, latitude, type, direction, wind_speed, presion, rafagas } = p.node;
        
        // Separamos las capas: las tormentas se dibujan en una segunda pasada para que estén por encima
        if ((type === 'thunderstorm') !== isThunderstormPass) return;
        
        let pixelPosMain = nodeProjections.get(`${p.node.id}_main`);
        if (!pixelPosMain) {
          const centerLng = map.getCenter().lng;
          let mainLng = longitude;
          mainLng = mainLng - 360 * Math.round((mainLng - centerLng) / 360);
          pixelPosMain = map.project([mainLng, latitude]);
          nodeProjections.set(`${p.node.id}_main`, pixelPosMain);
        }

        const x = pixelPosMain.x + p.offsetX;
        const y = pixelPosMain.y + p.offsetY;
        const zoomFactor = Math.max(0.2, currentMapZoom / 6);
        
        ctx.beginPath();
        
        if (type === 'rain') {
          const dropLength = 20 * zoomFactor;
          const dropWidth = 5 * zoomFactor;
          
          ctx.moveTo(x, y);
          ctx.lineTo(x - dropWidth, y + dropLength);
          const opacity = Math.max(0, 0.7 - Math.abs(p.offsetY) / p.baseRadius);
          ctx.strokeStyle = `rgba(50, 130, 255, ${opacity})`;
          ctx.lineWidth = Math.max(0.5, 1.5 * zoomFactor);
          ctx.lineCap = 'round';
          ctx.stroke();
          
        } else if (type === 'snow') {
          const snowRadius = Math.max(0.5, (2 * p.speed + 1) * zoomFactor);
          ctx.arc(x, y, snowRadius, 0, Math.PI * 2);
          const opacity = Math.max(0, 0.8 - Math.abs(p.offsetY) / p.baseRadius);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fill();
          
        } else if (type === 'wind') {
          const angleRad = (direction - 90) * Math.PI / 180;
          const length = (8 + (p.speed * 4)) * zoomFactor;
          const tailX = x - Math.cos(angleRad) * length;
          const tailY = y - Math.sin(angleRad) * length;
          
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(x, y);
          
          const fade = Math.sin(p.life * Math.PI); 
          let strokeColor = `rgba(180, 230, 255, ${fade * 0.5})`; 
          
          if (rafagas > 90 || presion < 990) {
            strokeColor = `rgba(220, 20, 150, ${fade * 0.8})`; 
            ctx.lineWidth = 2.5; 
          } else if (rafagas > 60 || presion < 1005) {
            strokeColor = `rgba(255, 140, 0, ${fade * 0.6})`; 
            ctx.lineWidth = 2.0;
          } else {
            ctx.lineWidth = 1.8;
          }
          
          ctx.strokeStyle = strokeColor;
          ctx.lineCap = 'round';
          ctx.stroke();
          
        } else if (type === 'thunderstorm') {
          let opacity = 0;
          if (p.flashTimer < 0.25) opacity = p.flashTimer / 0.25; 
          else if (p.flashTimer < 0.75) opacity = 1.0; 
          else if (p.flashTimer < 1.75) opacity = 1.0 - ((p.flashTimer - 0.75) / 1.0); 
          
          if (opacity > 0) {
            p.lightningForks.forEach(path => {
              ctx.moveTo(x + path[0][0], y + path[0][1]);
              for(let i=1; i<path.length; i++) {
                ctx.lineTo(x + path[i][0], y + path[i][1]);
              }
            });
            ctx.strokeStyle = `rgba(255, 255, 150, ${opacity})`;
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            ctx.stroke();
          }
        } else if (type === 'tornado_warning') {
          const radius = (p.baseRadius * 0.3) * (1 - p.life); 
          const vortexX = pixelPosMain.x + Math.cos(p.phase) * radius;
          const vortexY = pixelPosMain.y + Math.sin(p.phase) * radius - (1-p.life)*p.baseRadius;
          
          ctx.moveTo(vortexX, vortexY);
          ctx.lineTo(vortexX + Math.cos(p.phase + 0.5)*radius*0.8, vortexY + Math.sin(p.phase + 0.5)*radius*0.8);
          
          ctx.strokeStyle = `rgba(150, 50, 200, ${p.life})`;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else if (type === 'fog') {
          ctx.arc(x, y, 40 * p.speed, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(200, 200, 200, 0.05)';
          ctx.fill();
        }
      };

      offsets.forEach(dx => {
        ctx.save();
        ctx.translate(dx, 0);

        // Primera pasada: Dibuja viento, lluvia, nieve, niebla
        particles.forEach(p => drawParticle(p, false));
        
        // Segunda pasada: Dibuja rayos POR ENCIMA de todo lo demás
        particles.forEach(p => drawParticle(p, true));

        ctx.restore();
      });
      
      animationId = requestAnimationFrame(render);
    };
    
    map.on('resize', updateSize);
    map.on('moveend', updateVisibleNodes);
    map.on('zoomend', updateVisibleNodes);

    updateSize();
    updateVisibleNodes();
    animationId = requestAnimationFrame(render);
    
    return () => {
      cancelAnimationFrame(animationId);
      map.off('resize', updateSize);
      map.off('moveend', updateVisibleNodes);
      map.off('zoomend', updateVisibleNodes);
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
