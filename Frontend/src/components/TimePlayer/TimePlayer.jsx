import React, { useState, useEffect, useRef, useMemo } from 'react';
import useTimeBuffer from '../../hooks/useTimeBuffer';
import './TimePlayer.css';

const TimePlayer = ({
  globalHistoryArray,
  currentIndex,
  onIndexChange,
  isDynamicHistoricalMode,
  setCorruptedDates
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const { preloadAll, getFrame, isFrameReady, isPreloading } = useTimeBuffer(globalHistoryArray, setCorruptedDates);
  
  // Refs for auto-scroll
  const activeTickRef = useRef(null);
  const timelineWrapperRef = useRef(null);

  // Group globalHistoryArray by days
  const groupedDays = useMemo(() => {
    if (!globalHistoryArray || globalHistoryArray.length === 0) return [];
    
    const daysMap = new Map();
    globalHistoryArray.forEach((entry, idx) => {
      const d = new Date(entry.timestamp);
      // Key format: YYYY-MM-DD to group reliably
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          dateObj: d,
          hours: []
        });
      }
      
      daysMap.get(dateKey).hours.push({
        idx,
        hourStr: String(d.getHours()).padStart(2, '0') + 'h',
        timestamp: entry.timestamp,
        isPrediction: entry.isPrediction
      });
    });
    
    return Array.from(daysMap.values());
  }, [globalHistoryArray]);

  // Auto-scroll to active tick when currentIndex changes
  useEffect(() => {
    if (activeTickRef.current && timelineWrapperRef.current) {
      activeTickRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentIndex]);

  // Start preloading when component mounts in historical mode
  useEffect(() => {
    if (isDynamicHistoricalMode) {
      preloadAll();
    }
  }, [isDynamicHistoricalMode, preloadAll]);

  // --- Sincronizar fotograma estático cuando está en pausa o scrub ---
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    if (!isPlaying) {
      const frame = getFrame(currentIndex);
      if (frame) {
        window.dispatchEvent(new CustomEvent('timeplayer-update', {
          detail: {
            currentTempImg: frame.tempImg || null,
            nextTempImg: frame.tempImg || null,
            currentVisImg: frame.visImg || null,
            nextVisImg: frame.visImg || null,
            currentRainImg: frame.rainImg || null,
            nextRainImg: frame.rainImg || null,
            currentSnowImg: frame.snowImg || null,
            nextSnowImg: frame.snowImg || null,
            currentWindImg: frame.windImg || null,
            nextWindImg: frame.windImg || null,
            currentAqiImg: frame.aqiImg || null,
            nextAqiImg: frame.aqiImg || null,
            mixFactor: 0.0
          }
        }));
      }
    }
  }, [currentIndex, isPlaying, getFrame]);

  // --- Bucle de Animación a 60FPS (Crossfading) ---
  useEffect(() => {
    if (!isPlaying || !isDynamicHistoricalMode) return;

    let animationId;
    let lastTime = performance.now();
    let mixFactor = 0.0;

    const animate = (time) => {
      const delta = time - lastTime;
      lastTime = time;

      const idx = currentIndexRef.current;
      const nextIdx = idx + 1;

      if (nextIdx >= globalHistoryArray.length) {
        setIsPlaying(false);
        setIsBuffering(false);
        return;
      }

      if (!isFrameReady(idx) || !isFrameReady(nextIdx)) {
        setIsBuffering(true);
        animationId = requestAnimationFrame(animate);
        return;
      }

      setIsBuffering(true); // default loading
      setIsBuffering(false);
      mixFactor += delta / 3500.0; // 4.5 seconds per frame transition for smoother effect

      if (mixFactor >= 1.0) {
        mixFactor -= 1.0;
        onIndexChange(nextIdx);
      }

      const cFrame = getFrame(idx);
      const nFrame = getFrame(nextIdx);
      if (cFrame && nFrame) {
        window.dispatchEvent(new CustomEvent('timeplayer-update', {
          detail: {
            currentTempImg: cFrame.tempImg || null,
            nextTempImg: nFrame.tempImg || null,
            currentVisImg: cFrame.visImg || null,
            nextVisImg: nFrame.visImg || null,
            currentRainImg: cFrame.rainImg || null,
            nextRainImg: nFrame.rainImg || null,
            currentSnowImg: cFrame.snowImg || null,
            nextSnowImg: nFrame.snowImg || null,
            currentWindImg: cFrame.windImg || null,
            nextWindImg: nFrame.windImg || null,
            currentAqiImg: cFrame.aqiImg || null,
            nextAqiImg: nFrame.aqiImg || null,
            mixFactor: Math.min(mixFactor, 1.0)
          }
        }));
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, isDynamicHistoricalMode, globalHistoryArray, isFrameReady, getFrame, onIndexChange]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleHourClick = (newIndex, e) => {
    // Prevent click if user was dragging (threshold > 5px)
    if (timelineWrapperRef.current) {
      const currentX = e.pageX - timelineWrapperRef.current.offsetLeft;
      if (Math.abs(currentX - startX) > 5) return;
    }
    
    onIndexChange(newIndex);
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  // Drag-to-scroll handlers
  const handleMouseDown = (e) => {
    if (!timelineWrapperRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - timelineWrapperRef.current.offsetLeft);
    setScrollLeft(timelineWrapperRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !timelineWrapperRef.current) return;
    e.preventDefault();
    const x = e.pageX - timelineWrapperRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed multiplier
    timelineWrapperRef.current.scrollLeft = scrollLeft - walk;
  };

  if (!globalHistoryArray || globalHistoryArray.length === 0) return null;

  return (
    <div className="timeplayer-container">
      <div className="timeplayer-controls">
        <button
          className={`timeplayer-play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlay}
          title={isPlaying ? "Pausar" : "Reproducir"}
          disabled={isPreloading}
          style={{ opacity: isPreloading ? 0.5 : 1, pointerEvents: isPreloading ? 'none' : 'auto' }}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        {isBuffering && !isPreloading && <span className="timeplayer-buffering-indicator">Buffering...</span>}
      </div>

      {isPreloading && (
        <div className="timeplayer-preloading-overlay">
          <div className="spinner"></div>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cargando historial (0 FPS lag)...</span>
        </div>
      )}

      <div 
        className={`timeplayer-timeline-wrapper ${isDragging ? 'dragging' : ''}`}
        ref={timelineWrapperRef}
        style={{ 
          opacity: isPreloading ? 0.3 : 1, 
          pointerEvents: isPreloading ? 'none' : 'auto',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div className="timeline-days-container">
          {groupedDays.map((dayData, dayIdx) => (
            <div className="timeline-day-block" key={dayIdx}>
              <div className="timeline-day-header">
                {dayData.dateObj.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' })}
              </div>
              <div className="timeline-hours-row">
                {dayData.hours.map((hour) => {
                  const isActive = hour.idx === currentIndex;
                  const isPred = hour.isPrediction;
                  return (
                    <div
                      key={hour.idx}
                      ref={isActive ? activeTickRef : null}
                      className={`timeline-hour-tick ${isActive ? 'active' : ''} ${isPred ? 'prediction-tick' : ''}`}
                      onClick={(e) => handleHourClick(hour.idx, e)}
                      title={isPred ? "Predicción / Proyección Futura" : "Dato Histórico Real"}
                    >
                      {hour.hourStr}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimePlayer;
