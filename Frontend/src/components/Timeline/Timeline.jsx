import React, { useRef, useEffect, useMemo, useState } from 'react';
import './Timeline.css';

// Componente que reemplaza a la antigua barra del Timeline
// Formato: Cajón (Widget) de Previsión Histórica / Forecast Widget
const Timeline = ({ cityHistoryArray, currentIndex, onIndexChange, isGlobal = false }) => {
  const scrollRef = useRef(null);
  const [isDraggingState, setIsDraggingState] = useState(false);
  
  // Drag-to-scroll state
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    hasDragged.current = false;
    setIsDraggingState(true);
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    setIsDraggingState(false);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setIsDraggingState(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; // Scroll speed multiplier
    if (Math.abs(walk) > 5) {
      hasDragged.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };


  // Determinar cuál es la carta del "Momento Actual" (la más cercana al reloj local)
  const currentHourIndex = useMemo(() => {
    if (!cityHistoryArray || cityHistoryArray.length === 0) return -1;
    const now = Date.now();
    let closestIndex = -1;
    let minDiff = Infinity;
    
    cityHistoryArray.forEach((e) => {
      const diff = Math.abs(new Date(e.timestamp).getTime() - now);
      if (diff < minDiff) { 
         minDiff = diff; 
         closestIndex = e.index; 
      }
    });
    return closestIndex;
  }, [cityHistoryArray]);

  // Auto-scroll al elemento seleccionado cuando se abre o cambia
  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('.history-card.active');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        const currentElement = scrollRef.current.querySelector('.history-card.current-time');
        if (currentElement) {
           currentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  }, [currentIndex, cityHistoryArray]);

  if (!cityHistoryArray || cityHistoryArray.length === 0) {
    return null;
  }

  return (
    <div className="forecast-widget-container">
      <div 
        className="forecast-scroll-area" 
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        style={{ cursor: isDraggingState ? 'grabbing' : 'grab' }}
      >
        {cityHistoryArray.map((entry) => {
          const isSelected = entry.index === currentIndex;
          const isCurrentHour = entry.index === currentHourIndex;
          
          const dateObj = new Date(entry.timestamp);
          const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div 
              key={entry.index} 
              className={`history-card ${isSelected ? 'active' : ''} ${isCurrentHour ? 'current-time' : ''} ${!entry.isAvailable ? 'disabled' : ''}`}
              style={!entry.isAvailable ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
              onClick={(e) => {
                if (hasDragged.current || !entry.isAvailable) {
                  e.stopPropagation();
                  return;
                }
                onIndexChange(entry.index);
              }}
            >
              {isCurrentHour && <div className="history-card-badge">ACTUAL</div>}
              {entry.isPrediction && <div className="history-card-badge" style={{ background: 'var(--accent)', color: 'white' }}>IA</div>}
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="history-card-time" style={{ fontSize: '0.65rem', marginBottom: '2px', opacity: 0.7 }}>
                  {dateObj.toLocaleDateString([], { day: '2-digit', month: 'short' })}
                </span>
                <span className="history-card-time" style={isGlobal ? { marginBottom: '0', fontSize: '13px' } : {}}>{timeString}</span>
              </div>
              {!isGlobal && (
                <div className="history-card-temp">
                  {entry.data.temperatura != null ? `${Math.round(entry.data.temperatura)}°` : '--°'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
