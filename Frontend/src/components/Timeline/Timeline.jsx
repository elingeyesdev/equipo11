import React, { useRef, useEffect, useMemo, useState } from 'react';
import './Timeline.css';

const Timeline = ({ 
  cityHistoryArray, 
  currentIndex, 
  onIndexChange, 
  isGlobal = false,
  isCompareMode = false,
  compareIndexA = null,
  compareIndexB = null,
  onCompareIndexChange = () => {}
}) => {
  const scrollRef = useRef(null);
  const [isDraggingState, setIsDraggingState] = useState(false);

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
    const walk = (x - startX.current) * 2;
    if (Math.abs(walk) > 5) {
      hasDragged.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleItemClick = (index) => {
    if (hasDragged.current) return;
    if (isCompareMode) {
      if (compareIndexA === null || (compareIndexA !== null && compareIndexB !== null)) {
        onCompareIndexChange('A', index);
        onCompareIndexChange('B', null);
      } else {
        onCompareIndexChange('B', index);
      }
    } else {
      onIndexChange(index);
    }
  };

  const currentHourIndex = useMemo(() => {
    if (!cityHistoryArray || cityHistoryArray.length === 0) return -1;
    const now = Date.now();
    let closestIndex = -1;
    let minDiff = Infinity;
    cityHistoryArray.forEach((e, idx) => {
      const diff = Math.abs(new Date(e.timestamp).getTime() - now);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = idx;
      }
    });
    return closestIndex;
  }, [cityHistoryArray]);

  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector('.history-card.active');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex, compareIndexA, compareIndexB, isCompareMode]);

  if (!cityHistoryArray || cityHistoryArray.length === 0) return null;

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
        {cityHistoryArray.map((entry, index) => {
          const isActive = isCompareMode 
            ? (index === compareIndexA || index === compareIndexB)
            : index === currentIndex;
          
          const isA = isCompareMode && index === compareIndexA;
          const isB = isCompareMode && index === compareIndexB;
          const isCurrentHour = index === currentHourIndex;

          const dateObj = new Date(entry.timestamp);
          const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={index}
              className={`history-card ${isActive ? 'active' : ''} ${isA ? 'active-a' : ''} ${isB ? 'active-b' : ''} ${isCurrentHour ? 'current-time' : ''}`}
              onClick={() => handleItemClick(index)}
            >
              {isA && <div className="compare-badge badge-a">IZQ</div>}
              {isB && <div className="compare-badge badge-b">DER</div>}
              {!isA && !isB && isCurrentHour && <div className="history-card-badge">ACTUAL</div>}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="history-card-date">
                  {dateObj.toLocaleDateString([], { day: '2-digit', month: 'short' })}
                </span>
                <span className="history-card-time">{timeString}</span>
              </div>

              {!isGlobal && (
                <div className="history-card-temp">
                  {entry.data?.temperatura != null ? `${Math.round(entry.data.temperatura)}°` : '--°'}
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
