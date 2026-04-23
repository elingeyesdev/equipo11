import React, { useRef, useEffect, useMemo } from 'react';
import './Timeline.css';

// Componente que reemplaza a la antigua barra del Timeline
// Formato: Cajón (Widget) de Previsión Histórica / Forecast Widget
const Timeline = ({ cityHistoryArray, currentIndex, onIndexChange }) => {
  const scrollRef = useRef(null);

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
      <div className="forecast-scroll-area" ref={scrollRef}>
        {cityHistoryArray.map((entry) => {
          const isSelected = entry.index === currentIndex;
          const isCurrentHour = entry.index === currentHourIndex;
          
          const dateObj = new Date(entry.timestamp);
          const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div 
              key={entry.index} 
              className={`history-card ${isSelected ? 'active' : ''} ${isCurrentHour ? 'current-time' : ''}`}
              onClick={() => onIndexChange(entry.index)}
            >
              {isCurrentHour && <div className="history-card-badge">ACTUAL</div>}
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="history-card-time" style={{ fontSize: '0.65rem', marginBottom: '2px', opacity: 0.7 }}>
                  {dateObj.toLocaleDateString([], { day: '2-digit', month: 'short' })}
                </span>
                <span className="history-card-time">{timeString}</span>
              </div>
              <div className="history-card-temp">
                {entry.data.temperature !== null ? `${Math.round(entry.data.temperature)}°` : '--°'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
