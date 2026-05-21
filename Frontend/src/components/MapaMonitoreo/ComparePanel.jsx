import { useCallback } from 'react';
import './ComparePanel.css';

function ComparePanel({
  swipePos,
  setSwipePos,
  compareIndexA,
  compareIndexB,
  globalHistoryArray,
  formatTime,
  children
}) {
  const handleSwipeMouseDown = useCallback((e) => {
    const startX = e.pageX;
    const startPos = swipePos;
    const handleMouseMove = (mv) => {
      const delta = ((mv.pageX - startX) / window.innerWidth) * 100;
      setSwipePos(Math.max(0, Math.min(100, startPos + delta)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [swipePos, setSwipePos]);

  return (
    <>
      <div
        className="map-b-clip-container"
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          clipPath: `inset(0 0 0 ${swipePos}%)`, zIndex: 10, pointerEvents: 'none'
        }}
      >
        {children}
      </div>

      <div
        className="map-swipe-handle"
        style={{
          position: 'absolute', top: 0, bottom: 0, left: `${swipePos}%`, width: '4px',
          background: 'white', boxShadow: '0 0 10px rgba(0,0,0,0.5)', zIndex: 20,
          cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onMouseDown={handleSwipeMouseDown}
      >
        <div style={{ width: '40px', height: '40px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', color: '#333' }}>
          ↔
        </div>

        <div style={{ position: 'absolute', top: '20px', left: '-130px', background: 'rgba(0,0,0,0.8)', color: '#06b6d4', padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #06b6d4' }}>
          IZQ: {globalHistoryArray[compareIndexA]?.timestamp ? formatTime(globalHistoryArray[compareIndexA].timestamp) : '...'}
        </div>
        <div style={{ position: 'absolute', top: '20px', right: '-130px', background: 'rgba(0,0,0,0.8)', color: '#f59e0b', padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #f59e0b' }}>
          DER: {globalHistoryArray[compareIndexB]?.timestamp ? formatTime(globalHistoryArray[compareIndexB].timestamp) : '...'}
        </div>
      </div>
    </>
  );
}

export default ComparePanel;
