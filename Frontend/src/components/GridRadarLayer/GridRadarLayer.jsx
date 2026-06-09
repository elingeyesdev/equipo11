import { useMemo, useEffect, useRef } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';
import { getImageDataArray, sampleWindBilinear } from '../../utils/windMath';

const GRID_WIDTH = 360;
const GRID_HEIGHT = 180;

const getWeatherColor = (type) => {
  if (type === 'rain') return '#3b82f6';
  if (type === 'snow') return '#ffffff';
  if (type === 'fog') return '#9ca3af';
  if (type === 'wind') return '#a7f3d0';
  if (type === 'thunderstorm') return '#fbbf24';
  if (type === 'tornado_warning') return '#9333ea';
  return null;
};

const GridRadarLayer = ({ scannedGrid, currentZoom = 6, particleFilters = { rain: true, snow: true, wind: true, fog: true, thunderstorm: true, tornado_warning: true } }) => {
  const { current: map } = useMap();
  const canvasRef = useRef(null);
  const windPixelsRef = useRef(null);

  const { activeNodes } = useMemo(() => {
    const nodes = [];

    if (!scannedGrid) return { activeNodes: nodes };

    const windPixels = scannedGrid.windImg ? getImageDataArray(scannedGrid.windImg) : null;
    windPixelsRef.current = windPixels;
    const rainPixels = scannedGrid.rainImg ? getImageDataArray(scannedGrid.rainImg) : null;
    const snowPixels = scannedGrid.snowImg ? getImageDataArray(scannedGrid.snowImg) : null;

    let nodeIndex = 0;
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        const idx = (row * GRID_WIDTH + col) * 4;

        // Valores de física por defecto (Brisa suave cayendo hacia abajo)
        let speed = 5; 
        let direction = 180; 

        if (windPixels) {
          const windR = windPixels.data[idx];
          const windG = windPixels.data[idx + 1];
          const windA = windPixels.data[idx + 3];
          if (windA > 0) {
            speed = (windR / 255.0) * 150.0;
            direction = (windG / 255.0) * 360.0;
          }
        }

        let type = null;
        let isTypeEnabled = false;

        // Detección de Nieve
        if (snowPixels && particleFilters.snow !== false) {
          const snowVal = snowPixels.data[idx];
          const snowA = snowPixels.data[idx + 3];
          if (snowA > 0 && snowVal > 5) {
            type = 'snow';
            isTypeEnabled = true;
          }
        }

        // Detección de Lluvia
        if (!type && rainPixels && particleFilters.rain !== false) {
          const rainVal = rainPixels.data[idx];
          const rainA = rainPixels.data[idx + 3];
          if (rainA > 0 && rainVal > 5) {
            type = 'rain';
            isTypeEnabled = true;
          }
        }

        // Detección de Viento Fuerte
        if (!type && windPixels && speed > 15 && particleFilters.wind !== false) {
          type = 'wind';
          isTypeEnabled = true;
        }

        if (!type || !isTypeEnabled) continue;

        const lat = row - 89.5;
        const lon = col - 179.5;

        nodes.push({
          id: nodeIndex++,
          longitude: lon,
          latitude: lat,
          type: type,
          direction: direction,
          wind_speed: speed,
          presion: 1013,
          rafagas: 0
        });
      }
    }

    return { activeNodes: nodes };
  }, [scannedGrid, particleFilters]);


  // Motor de renderizado Canvas
  useEffect(() => {
    if (!map || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });

    let animationId;
    let lastTime = performance.now();

    // ----------------------------------------------------
    // OBJECT POOLING PARA PREVENIR MEMORY LEAKS
    // ----------------------------------------------------
    const MAX_PARTICLES = 5000;
    const particlePool = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      node: null,
      offsetX: 0,
      offsetY: 0,
      speed: 0,
      phase: 0,
      life: 0,
      baseRadius: 0,
      flashTimer: 0,
      lightningForks: null,
      currentDirection: 0,
      currentSpeed: 0
    }));
    let visibleNodes = [];
    // Función para filtrar qué nodos están en el viewport
    const updateVisibleNodes = () => {
      if (!map) return;
      const bounds = map.getBounds();
      const buffer = 1.0; // 1 grado de margen
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const centerLng = map.getCenter().lng;

      visibleNodes = activeNodes.filter(node => {
        if (node.latitude < sw.lat - buffer || node.latitude > ne.lat + buffer) return false;

        // Envoltura horizontal matemática para el antimeridiano:
        // Proyectamos la longitud del nodo al "mundo continuo" que el usuario está viendo
        let mainLng = node.longitude;
        mainLng = mainLng - 360 * Math.round((mainLng - centerLng) / 360);

        return mainLng >= sw.lng - buffer && mainLng <= ne.lng + buffer;
      });

      initParticles();
    };

    const initParticles = () => {
      // Reciclaje de objetos: Desactivar todas las partículas en lugar de instanciar un arreglo nuevo
      for (let i = 0; i < MAX_PARTICLES; i++) {
        particlePool[i].active = false;
      }

      const currentMapZoom = map.getZoom();
      const baseRadius = Math.max(5, 40 * Math.pow(2, currentMapZoom - 6));

      // Repartición uniforme para no agotar el pool en el sur
      const step = Math.max(1, Math.ceil(visibleNodes.length / (MAX_PARTICLES / 3)));
      let poolIndex = 0;

      for (let n = 0; n < visibleNodes.length; n += step) {
        const node = visibleNodes[n];
        let pCount = currentMapZoom > 5 ? (node.type === 'wind' ? 6 : 10) : (currentMapZoom > 3 ? (node.type === 'wind' ? 3 : 2) : (node.type === 'wind' ? 2 : 1));
        if (node.type === 'thunderstorm' || node.type === 'tornado_warning') pCount = currentMapZoom > 5 ? 3 : 1;

        // Reducir masivamente la densidad de partículas al hacer zoom out para mantener un rendimiento alto
        if (currentMapZoom < 4 && Math.random() > 0.4) pCount = 0;

        for (let i = 0; i < pCount; i++) {
          if (poolIndex >= MAX_PARTICLES) return; // Límite estricto de partículas

          const p = particlePool[poolIndex++];
          p.active = true;
          p.node = node;
          p.offsetX = (Math.random() - 0.5) * baseRadius * 2;
          p.offsetY = (Math.random() - 0.5) * baseRadius * 2;
          p.speed = Math.random() * 0.5 + 0.5;
          p.phase = Math.random() * Math.PI * 2;
          p.life = Math.random();
          p.baseRadius = baseRadius;
          p.flashTimer = Math.random() * 50; // Para relámpagos
          p.currentDirection = node.direction || 0;
          p.currentSpeed = node.wind_speed || 0;
        }
      }
    };

    const updateSize = () => {
      const container = map.getContainer();
      // Limitar pixelRatio a 1.5 para evitar 4x overdraw en pantallas Retina/4K
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = container.clientWidth * pixelRatio;
      canvas.height = container.clientHeight * pixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset antes de escalar
      ctx.scale(pixelRatio, pixelRatio);
    };

    const render = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const currentMapZoom = map.getZoom();

      // Reemplazo de clearRect para crear estelas curvas
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Mientras menor el alpha, más larga es la estela visual
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      // ACTUALIZACIÓN DE PROYECCIONES (0 Asignaciones de memoria)
      const centerLng = map.getCenter().lng;
      for (let i = 0; i < visibleNodes.length; i++) {
        const node = visibleNodes[i];
        let mainLng = node.longitude - 360 * Math.round((node.longitude - centerLng) / 360);
        const proj = map.project([mainLng, node.latitude]);
        node.pixelX = proj.x;
        node.pixelY = proj.y;
      }
      // ACTUALIZACIÓN DE FÍSICA
      const zoomFactor = Math.max(0.2, currentMapZoom / 6);
      const pxPerDeg = Math.max(1, 40 * Math.pow(2, currentMapZoom - 6));

      // NUEVO: Grilla de ocupación corregida a píxeles lógicos (CSS)
      const CELL_SIZE = 10; 
      const gridCols = Math.ceil((canvas.clientWidth || window.innerWidth) / CELL_SIZE);
      const gridRows = Math.ceil((canvas.clientHeight || window.innerHeight) / CELL_SIZE);
      const occupancy = new Uint8Array(gridCols * gridRows);

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particlePool[i];
        if (!p.active) continue;

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
          if (p.currentDirection === undefined || isNaN(p.currentDirection)) p.currentDirection = p.node.direction || 0;
          if (p.currentSpeed === undefined || isNaN(p.currentSpeed)) p.currentSpeed = p.node.wind_speed || 0;

          if (windPixelsRef.current) {
            const pLng = p.node.longitude + ((p.offsetX || 0) / pxPerDeg);
            const pLat = p.node.latitude - ((p.offsetY || 0) / pxPerDeg);

            // CPU HACK: Lectura directa de memoria sin invocar funciones
            const col = Math.floor(pLng + 179.5);
            const row = Math.floor(pLat + 89.5);
            if (col >= 0 && col < 360 && row >= 0 && row < 180) {
              const idx = (row * 360 + col) * 4;
              const windA = windPixelsRef.current.data[idx + 3];
              if (windA > 0) {
                const localSpeed = (windPixelsRef.current.data[idx] / 255.0) * 150.0;
                const localDir = (windPixelsRef.current.data[idx + 1] / 255.0) * 360.0;
                let diff = localDir - p.currentDirection;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                p.currentDirection += diff * 0.15;
                p.currentSpeed = localSpeed;
              }
            }
          }

          const angleRad = (p.currentDirection - 90) * Math.PI / 180;
          // Reducimos el divisor de 35 a 20 para que los km/h impacten más rápido
          let windIntensity = Math.max(5, p.currentSpeed) / 20; 
          // Elevamos el tope de intensidad máxima de 1.8 a 3.5 para permitir huracanes veloces
          windIntensity = Math.min(windIntensity, 3.5); 
          // Duplicamos el multiplicador base de velocidad (de 1.2 a 2.5)
          const velocity = (p.baseRadius * 2.5) * (p.speed || 1) * windIntensity;

          p.offsetX += Math.cos(angleRad) * velocity * dt;
          p.offsetY += Math.sin(angleRad) * velocity * dt;

          // 1. Calcular posición real en pantalla (Píxeles CSS)
          const screenX = p.node.pixelX + p.offsetX;
          const screenY = p.node.pixelY + p.offsetY;
          
          // 2. Spatial Hashing Estricto (Regla de Exclusión 1 a 1)
          const gx = Math.floor(screenX / CELL_SIZE);
          const gy = Math.floor(screenY / CELL_SIZE);
          
          if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
            const idx = gy * gridCols + gx;
            if (occupancy[idx] > 0) {
              // Si el cuadrito ya está ocupado, la partícula invasora MUERE INSTANTÁNEAMENTE
              p.life = -1;
            } else {
              // Reclama el cuadrito para esta partícula en este fotograma
              occupancy[idx] = 1;
            }
          }

          const speedPenalty = (p.currentSpeed > 30) ? (p.currentSpeed / 60) : 0;
          
          // 3. Drenaje de vida natural (sin sumar crowdingPenalty porque ahora usamos Instant Kill)
          p.life -= dt * (0.01 + (p.speed || 1) * 0.01 + (speedPenalty * 0.3)) / zoomFactor; 

          const dist = Math.sqrt((p.offsetX * p.offsetX) + (p.offsetY * p.offsetY));
          // 2. Leash gigante (10.0) para que no mueran por viajar muy lejos de su nodo
          if (dist > p.baseRadius * 10.0 || isNaN(dist)) p.life = -1;

          if (p.life <= 0) {
            p.life = 1;
            // Teletransporte total: Rompe la atadura al nodo congestionado
            if (visibleNodes.length > 0) {
              p.node = visibleNodes[Math.floor(Math.random() * visibleNodes.length)];
            }
            p.offsetX = (Math.random() - 0.5) * p.baseRadius * 5.0;
            p.offsetY = (Math.random() - 0.5) * p.baseRadius * 5.0;
            p.currentDirection = p.node.direction || 0;
            p.currentSpeed = p.node.wind_speed || 0;
          }
        } else if (type === 'thunderstorm') {
          p.flashTimer += dt;
          if (!p.lightningForks || p.flashTimer > 3.0) {
            p.flashTimer = 0;
            p.lightningForks = [];
            for (let k = 0; k < 2; k++) {
              let lx = (Math.random() - 0.5) * p.baseRadius;
              let ly = -p.baseRadius * 0.5;
              let path = [[lx, ly]];
              for (let j = 0; j < 4; j++) {
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
      }

      const drawParticle = (p, isThunderstormPass) => {
        const { longitude, latitude, type, direction, wind_speed, presion, rafagas } = p.node;

        // Separamos las capas: las tormentas se dibujan en una segunda pasada para que estén por encima
        if ((type === 'thunderstorm') !== isThunderstormPass) return;

        const x = p.node.pixelX + p.offsetX;
        const y = p.node.pixelY + p.offsetY;
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
          const angleRad = (p.currentDirection - 90) * Math.PI / 180;
          // La cabeza de la partícula se estira ligeramente si va muy rápido para que el desvanecimiento no se desconecte
          const length = (3 + ((p.speed || 1) * 3)) * zoomFactor * (p.currentSpeed > 40 ? 1.5 : 1); 
          const tailX = x - Math.cos(angleRad) * length;
          const tailY = y - Math.sin(angleRad) * length;

          ctx.moveTo(tailX, tailY);
          ctx.lineTo(x, y);

          const fade = Math.sin(p.life * Math.PI);
          let strokeColor;

          // Visibilidad unificada: Blanco brillante para destacar sobre el mapa de calor
          if (p.currentSpeed >= 90) {
            strokeColor = `rgba(255, 200, 255, ${fade})`; // Blanco-Magenta brillante (Extremo)
            ctx.lineWidth = 2.0;
          } else if (p.currentSpeed >= 60) {
            strokeColor = `rgba(255, 255, 255, ${fade})`;  // Blanco puro
            ctx.lineWidth = 1.8;
          } else {
            strokeColor = `rgba(255, 255, 255, ${fade})`; // Blanco puro para todos (Normal/Lento)
            ctx.lineWidth = 1.2;
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
              for (let i = 1; i < path.length; i++) {
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
          const vortexX = p.node.pixelX + Math.cos(p.phase) * radius;
          const vortexY = p.node.pixelY + Math.sin(p.phase) * radius - (1 - p.life) * p.baseRadius;

          ctx.moveTo(vortexX, vortexY);
          ctx.lineTo(vortexX + Math.cos(p.phase + 0.5) * radius * 0.8, vortexY + Math.sin(p.phase + 0.5) * radius * 0.8);

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

      // Primera pasada: Dibuja viento, lluvia, nieve, niebla
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (particlePool[i].active) drawParticle(particlePool[i], false);
      }

      // Segunda pasada: Dibuja rayos POR ENCIMA de todo lo demás
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (particlePool[i].active) drawParticle(particlePool[i], true);
      }

      animationId = requestAnimationFrame(render);
    };

    // --- Pausa Temprana: Control de arranque/parada del motor ---
    let isRunning = false;

    const maybeStartEngine = () => {
      const currentZoom = map.getZoom();
      const shouldRun = currentZoom >= 3.0 && visibleNodes.length > 0;

      if (shouldRun && !isRunning) {
        isRunning = true;
        lastTime = performance.now();
        animationId = requestAnimationFrame(render);
        console.log('[Performance] Motor de partículas REANUDADO');
      } else if (!shouldRun && isRunning) {
        isRunning = false;
        cancelAnimationFrame(animationId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('[Performance] Motor de partículas PAUSADO (Zoom out / Fuera de vista)');
      }
    };

    // Envolver updateVisibleNodes para re-evaluar el throttle
    const originalUpdateVisibleNodes = updateVisibleNodes;
    const throttledUpdate = () => {
      originalUpdateVisibleNodes();
      maybeStartEngine();
    };

    map.on('resize', updateSize);
    map.on('moveend', throttledUpdate);
    map.on('zoomend', throttledUpdate);

    updateSize();
    throttledUpdate(); // Evaluar si el motor debe arrancar

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      map.off('resize', updateSize);
      map.off('moveend', throttledUpdate);
      map.off('zoomend', throttledUpdate);
    };
  }, [map, activeNodes]);

  return (
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
  );
};

export default GridRadarLayer;
