import React, { useState, useEffect, useRef } from 'react';
import useTimeBuffer from '../../hooks/useTimeBuffer';
import { formatTime, formatDate } from '../../utils/formatters';
import './TimePlayer.css';

const TimePlayer = ({
  globalHistoryArray,
  currentIndex,
  onIndexChange,
  isDynamicHistoricalMode
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const { preloadAll, getFrame, isFrameReady, isPreloading } = useTimeBuffer(globalHistoryArray);

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

      setIsBuffering(false);
      mixFactor += delta / 1500.0; // 1.5 seconds per frame transition for smoother effect

      if (mixFactor >= 1.0) {
        mixFactor -= 1.0;
        onIndexChange(nextIdx);
        // El padre actualizará currentIndex y currentIndexRef,
        // el ciclo continúa con el residuo del mixFactor para ser exactos.
      }

      const cFrame = getFrame(idx);
      const nFrame = getFrame(nextIdx);
      if (cFrame && nFrame) {
        window.dispatchEvent(new CustomEvent('timeplayer-update', {
          detail: {
            currentTempImg: cFrame.tempImg || null,
            nextTempImg: nFrame.tempImg || null,
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

  const handleSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    onIndexChange(newIndex);

    // Stop playing when user manually seeks
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  if (!globalHistoryArray || globalHistoryArray.length === 0) return null;

  const currentEntry = globalHistoryArray[currentIndex];
  if (!currentEntry) return null;

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

        <div className="timeplayer-info">
          <span className="timeplayer-date">
            {new Date(currentEntry.timestamp).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="timeplayer-time">- {formatTime(currentEntry.timestamp)}</span>
          {isBuffering && !isPreloading && <span className="timeplayer-buffering-indicator">Buffering...</span>}
        </div>
      </div>

      {isPreloading && (
        <div className="timeplayer-preloading-overlay" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#38bdf8', backdropFilter: 'blur(4px)', borderRadius: '12px'
        }}>
          <div className="spinner" style={{
            border: '3px solid rgba(56, 189, 248, 0.3)', borderTop: '3px solid #38bdf8',
            borderRadius: '50%', width: '24px', height: '24px', animation: 'spin 1s linear infinite',
            marginBottom: '8px'
          }}></div>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cargando historial (0 FPS lag)...</span>
        </div>
      )}

      <div className="timeplayer-slider-wrapper" style={{ opacity: isPreloading ? 0.3 : 1, pointerEvents: isPreloading ? 'none' : 'auto' }}>
        <input
          type="range"
          min="0"
          max={globalHistoryArray.length - 1}
          step="1"
          value={currentIndex}
          onChange={handleSliderChange}
          className="timeplayer-slider"
        />

        {/* Marcadores visuales opcionales para la línea de tiempo */}
        <div className="timeplayer-ticks">
          {globalHistoryArray.map((entry, idx) => {
            // Mostrar un tick cada ciertas horas o al cambiar de día
            const showTick = idx === 0 || idx === globalHistoryArray.length - 1 ||
              new Date(entry.timestamp).getHours() === 0;
            if (!showTick) return null;

            return (
              <div
                key={idx}
                className="timeplayer-tick"
                style={{ left: `${(idx / (globalHistoryArray.length - 1)) * 100}%` }}
              >
                {new Date(entry.timestamp).getHours() === 0 ? formatDate(entry.timestamp).split(' ')[0] : ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimePlayer;
