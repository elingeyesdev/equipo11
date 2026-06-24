import React, { useMemo, useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/mapbox';

const HistoricalWindParticles = ({ isActive, windPixels, windSize, currentZoom = 6, isOffset = false }) => {
  const { current: map } = useMap();
  const canvasRef = useRef(null);

  const { activeNodes } = useMemo(() => {
    const nodes = [];
    if (!isActive || !windPixels || !windSize) return { activeNodes: nodes };

    const { width, height } = windSize;
    let nodeIndex = 0;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = (row * width + col) * 4;

        const windR = windPixels[idx];
        const windG = windPixels[idx + 1];
        const windA = windPixels[idx + 3];

        if (windA > 0) {
          const u_norm = windR / 255.0;
          const v_norm = windG / 255.0;
          const u_ms = (u_norm * 200.0) - 100.0;
          const v_ms = (v_norm * 200.0) - 100.0;
          
          const speed = Math.sqrt(u_ms * u_ms + v_ms * v_ms) * 3.6; // km/h
          const direction = (Math.atan2(v_ms, u_ms) * 180 / Math.PI) + 90;

          if (speed > 15) { // Threshold for rendering particles
            const lat = -90 + (row / height) * 180 + (90 / height);
            let lon = -180 + (col / width) * 360 + (180 / width);
            if (isOffset) {
              lon += 180;
              if (lon > 180) lon -= 360;
            }

            nodes.push({
              id: nodeIndex++,
              longitude: lon,
              latitude: lat,
              type: 'wind',
              direction: direction,
              wind_speed: speed
            });
          }
        }
      }
    }

    return { activeNodes: nodes };
  }, [isActive, windPixels, windSize, isOffset]);

  // Motor de renderizado Canvas
  useEffect(() => {
    if (!map || !canvasRef.current || !isActive || activeNodes.length === 0) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d', { alpha: true });
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });

    let animationId;
    let lastTime = performance.now();
    let isRunning = false;

    // ----------------------------------------------------
    // OBJECT POOLING
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
      currentDirection: 0,
      currentSpeed: 0
    }));

    let visibleNodes = [];

    const updateVisibleNodes = () => {
      if (!map) return;
      const bounds = map.getBounds();
      const buffer = 1.0; 
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const centerLng = map.getCenter().lng;

      visibleNodes = activeNodes.filter(node => {
        if (node.latitude < sw.lat - buffer || node.latitude > ne.lat + buffer) return false;
        let mainLng = node.longitude;
        mainLng = mainLng - 360 * Math.round((mainLng - centerLng) / 360);
        return mainLng >= sw.lng - buffer && mainLng <= ne.lng + buffer;
      });

      initParticles();
    };

    const initParticles = () => {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        particlePool[i].active = false;
      }

      const currentMapZoom = map.getZoom();
      const baseRadius = Math.max(5, 40 * Math.pow(2, currentMapZoom - 6));

      const step = Math.max(1, Math.ceil(visibleNodes.length / (MAX_PARTICLES / 3)));
      let poolIndex = 0;

      for (let n = 0; n < visibleNodes.length; n += step) {
        const node = visibleNodes[n];
        let pCount = currentMapZoom > 5 ? 6 : (currentMapZoom > 3 ? 3 : 2);

        if (currentMapZoom < 4 && Math.random() > 0.4) pCount = 0;

        for (let i = 0; i < pCount; i++) {
          if (poolIndex >= MAX_PARTICLES) return; 

          const p = particlePool[poolIndex++];
          p.active = true;
          p.node = node;
          p.offsetX = (Math.random() - 0.5) * baseRadius * 2;
          p.offsetY = (Math.random() - 0.5) * baseRadius * 2;
          p.speed = Math.random() * 0.5 + 0.5;
          p.phase = Math.random() * Math.PI * 2;
          p.life = Math.random(); // Distribuir asimétricamente el inicio
          p.baseRadius = baseRadius;
          p.currentDirection = node.direction || 0;
          p.currentSpeed = node.wind_speed || 0;
        }
      }
    };

    const updateSize = () => {
      const container = map.getContainer();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = container.clientWidth * pixelRatio;
      canvas.height = container.clientHeight * pixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0); 
      ctx.scale(pixelRatio, pixelRatio);
    };

    const render = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const currentMapZoom = map.getZoom();

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      const centerLng = map.getCenter().lng;
      for (let i = 0; i < visibleNodes.length; i++) {
        const node = visibleNodes[i];
        let mainLng = node.longitude - 360 * Math.round((node.longitude - centerLng) / 360);
        const proj = map.project([mainLng, node.latitude]);
        node.pixelX = proj.x;
        node.pixelY = proj.y;
      }

      const zoomFactor = Math.max(0.2, currentMapZoom / 6);
      const pxPerDeg = Math.max(1, 40 * Math.pow(2, currentMapZoom - 6));

      const CELL_SIZE = 10; 
      const gridCols = Math.ceil((canvas.clientWidth || window.innerWidth) / CELL_SIZE);
      const gridRows = Math.ceil((canvas.clientHeight || window.innerHeight) / CELL_SIZE);
      const occupancy = new Uint8Array(gridCols * gridRows);

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particlePool[i];
        if (!p.active) continue;

        if (windPixels && windSize) {
          const { width, height } = windSize;
          const pLng = p.node.longitude + ((p.offsetX || 0) / pxPerDeg);
          const pLat = p.node.latitude - ((p.offsetY || 0) / pxPerDeg);

          let col = Math.floor((pLng + 180) * (width / 360));
          if (isOffset) {
            col = (col + Math.floor(width / 2)) % width;
          }
          const row = Math.floor((pLat + 90) * (height / 180));
          if (col >= 0 && col < width && row >= 0 && row < height) {
            const idx = (row * width + col) * 4;
            const windA = windPixels[idx + 3];
            if (windA > 0) {
              const local_u_norm = windPixels[idx] / 255.0;
              const local_v_norm = windPixels[idx + 1] / 255.0;
              const local_u_ms = (local_u_norm * 200.0) - 100.0;
              const local_v_ms = (local_v_norm * 200.0) - 100.0;
              const localSpeed = Math.sqrt(local_u_ms * local_u_ms + local_v_ms * local_v_ms) * 3.6;
              const localDir = (Math.atan2(local_v_ms, local_u_ms) * 180 / Math.PI) + 90;

              let diff = localDir - p.currentDirection;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;
              p.currentDirection += diff * 0.15;
              p.currentSpeed = localSpeed;
            }
          }
        }

        const angleRad = (p.currentDirection - 90) * Math.PI / 180;
        let windIntensity = Math.max(5, p.currentSpeed) / 20; 
        windIntensity = Math.min(windIntensity, 3.5); 
        const velocity = (p.baseRadius * 2.5) * (p.speed || 1) * windIntensity;

        p.offsetX += Math.cos(angleRad) * velocity * dt;
        p.offsetY += Math.sin(angleRad) * velocity * dt;

        const screenX = p.node.pixelX + p.offsetX;
        const screenY = p.node.pixelY + p.offsetY;
        
        const gx = Math.floor(screenX / CELL_SIZE);
        const gy = Math.floor(screenY / CELL_SIZE);
        
        if (gx >= 0 && gx < gridCols && gy >= 0 && gy < gridRows) {
          const idx = gy * gridCols + gx;
          if (occupancy[idx] > 0) {
            p.life = -1;
          } else {
            occupancy[idx] = 1;
          }
        }

        const speedPenalty = (p.currentSpeed > 30) ? (p.currentSpeed / 60) : 0;
        // 1. Envejecimiento constante y desincronizado
        const baseDecay = 0.02; // Desgaste base incondicional garantizado
        p.life -= dt * (baseDecay + (p.speed || 1) * 0.01 + (speedPenalty * 0.3) + Math.random() * 0.005) / zoomFactor; 

        // 2. Kill Switch por baja velocidad (Evitar remolinos muertos)
        if (p.currentSpeed < 1.0) {
          p.life = -1;
        }

        const dist = Math.sqrt((p.offsetX * p.offsetX) + (p.offsetY * p.offsetY));
        if (dist > p.baseRadius * 10.0 || isNaN(dist)) p.life = -1;

        if (p.life <= 0) {
          p.life = 1;
          if (visibleNodes.length > 0) {
            p.node = visibleNodes[Math.floor(Math.random() * visibleNodes.length)];
          }
          p.offsetX = (Math.random() - 0.5) * p.baseRadius * 5.0;
          p.offsetY = (Math.random() - 0.5) * p.baseRadius * 5.0;
          p.currentDirection = p.node.direction || 0;
          p.currentSpeed = p.node.wind_speed || 0;
        }

        // Draw particle
        const x = p.node.pixelX + p.offsetX;
        const y = p.node.pixelY + p.offsetY;
        
        const length = (3 + ((p.speed || 1) * 3)) * zoomFactor * (p.currentSpeed > 40 ? 1.5 : 1); 
        const tailX = x - Math.cos(angleRad) * length;
        const tailY = y - Math.sin(angleRad) * length;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);

        const fade = Math.sin(p.life * Math.PI);
        let strokeColor;

        if (p.currentSpeed >= 90) {
          strokeColor = `rgba(255, 200, 255, ${fade})`;
          ctx.lineWidth = 2.0;
        } else if (p.currentSpeed >= 60) {
          strokeColor = `rgba(255, 255, 255, ${fade})`;
          ctx.lineWidth = 1.8;
        } else {
          strokeColor = `rgba(255, 255, 255, ${fade})`;
          ctx.lineWidth = 1.2;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      if (isRunning) {
        animationId = requestAnimationFrame(render);
      }
    };

    const clearAndPause = () => {
      isRunning = false;
      cancelAnimationFrame(animationId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const maybeStartEngine = () => {
      const currentZoom = map.getZoom();
      const shouldRun = currentZoom >= 3.0 && visibleNodes.length > 0 && isActive;

      if (shouldRun && !isRunning) {
        isRunning = true;
        lastTime = performance.now();
        animationId = requestAnimationFrame(render);
      } else if (!shouldRun && isRunning) {
        clearAndPause();
      }
    };

    const originalUpdateVisibleNodes = updateVisibleNodes;
    const throttledUpdate = () => {
      originalUpdateVisibleNodes();
      maybeStartEngine();
    };

    map.on('resize', updateSize);
    map.on('movestart', clearAndPause);
    map.on('zoomstart', clearAndPause);
    map.on('moveend', throttledUpdate);
    map.on('zoomend', throttledUpdate);

    updateSize();
    throttledUpdate();

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      map.off('resize', updateSize);
      map.off('movestart', clearAndPause);
      map.off('zoomstart', clearAndPause);
      map.off('moveend', throttledUpdate);
      map.off('zoomend', throttledUpdate);
    };
  }, [map, activeNodes, isActive]);

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

export default HistoricalWindParticles;
