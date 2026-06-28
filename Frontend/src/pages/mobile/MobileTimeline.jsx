import { useState, useRef, useEffect, useCallback } from 'react';
import './MobileTimeline.css';

export default function MobileTimeline({
  date,
  setDate,
  isPlaying,
  setIsPlaying,
  timelineTicks,
  minDate,
  maxDate
}) {
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const isDraggingRef = useRef(false);

  // Auto-Centrado
  useEffect(() => {
    if (isDraggingRef.current) return;
    const activeTickId = `mobile-tick-${date.getTime()}`;
    const element = document.getElementById(activeTickId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [date, timelineTicks]);

  const snapToNearestTick = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    const children = container.querySelectorAll('[id^="mobile-tick-"]');
    let closestChild = null;
    let closestDistance = Infinity;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(childCenter - containerCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestChild = child;
      }
    }

    if (closestChild && closestChild.id) {
      const timestamp = parseInt(closestChild.id.replace('mobile-tick-', ''));
      if (!isNaN(timestamp)) {
        const snappedDate = new Date(timestamp);
        const minTime = new Date(minDate + 'T00:00:00Z').getTime();
        const maxTime = new Date(maxDate + 'T23:00:00Z').getTime();
        if (timestamp >= minTime && timestamp <= maxTime) {
          setDate(snappedDate);
        }
      }
    }
  }, [setDate, minDate, maxDate]);

  // Manejadores Mouse
  const handleMouseDown = (e) => {
    setIsPlaying(false);
    setIsDragging(true);
    isDraggingRef.current = true;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      endDrag();
    }
  };
  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      endDrag();
    }
  };
  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Manejadores Touch
  const handleTouchStart = (e) => {
    setIsPlaying(false);
    setIsDragging(true);
    isDraggingRef.current = true;
    setStartX(e.touches[0].pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };
  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };
  const handleTouchEnd = () => {
    if (isDraggingRef.current) {
      endDrag();
    }
  };

  const endDrag = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    snapToNearestTick();
  };

  return (
    <div className="mobile-timeline-wrapper">
      <button 
        className="mobile-play-btn"
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {isPlaying ? (
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>

      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="mobile-timeline-scroll"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {(() => {
          const groups = {};
          timelineTicks.forEach(tickDate => {
            const dayKey = \`\${tickDate.getUTCFullYear()}-\${String(tickDate.getUTCMonth() + 1).padStart(2, '0')}-\${String(tickDate.getUTCDate()).padStart(2, '0')}\`;
            if (!groups[dayKey]) groups[dayKey] = [];
            groups[dayKey].push(tickDate);
          });

          const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

          return Object.entries(groups).map(([dayKey, ticks]) => {
            const sample = ticks[0];
            const dayNum = String(sample.getUTCDate()).padStart(2, '0');
            const monthNum = String(sample.getUTCMonth() + 1).padStart(2, '0');
            const weekday = dayNames[sample.getUTCDay()];

            return (
              <div key={dayKey} className="timeline-day-group">
                <span className="timeline-day-label">
                  {weekday} {dayNum}/{monthNum}
                </span>
                <div className="timeline-tick-row">
                  {ticks.map((tickDate) => {
                    const isSelected = tickDate.getTime() === date.getTime();
                    const hr = String(tickDate.getUTCHours()).padStart(2, '0');
                    return (
                      <div
                        key={tickDate.getTime()}
                        id={\`mobile-tick-\${tickDate.getTime()}\`}
                        onClick={() => {
                          setDate(tickDate);
                          if (scrollRef.current) {
                            setTimeout(() => {
                              const el = document.getElementById(\`mobile-tick-\${tickDate.getTime()}\`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                            }, 50);
                          }
                        }}
                        className={\`timeline-tick \${isSelected ? 'active' : 'inactive'}\`}
                      >
                        <span className="pointer-events-none">
                          {hr}:00
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
