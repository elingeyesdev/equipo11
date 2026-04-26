import React, { useState, useRef, useEffect } from 'react';

export default function Draggable({ children, initialPos = { x: 0, y: 0 }, style = {}, className = "" }) {
  const [pos, setPos] = useState(initialPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offset = useRef({ x: 0, y: 0 });

  const onPointerDown = (e) => {
    // Avoid dragging if clicking on an input, select, button, etc.
    const targetTag = e.target.tagName.toLowerCase();
    if (['input', 'select', 'option', 'button', 'textarea'].includes(targetTag)) {
      return;
    }
    
    // Prevent default to avoid text selection while dragging
    e.preventDefault();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    setIsDragging(true);
    offset.current = {
      x: clientX - pos.x,
      y: clientY - pos.y,
    };
    
    // Si queremos z-index extra al arrastrar
    if (dragRef.current) {
      dragRef.current.style.zIndex = 1000;
    }
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    setPos({
      x: clientX - offset.current.x,
      y: clientY - offset.current.y,
    });
  };

  const onPointerUp = () => {
    setIsDragging(false);
    if (dragRef.current) {
      dragRef.current.style.zIndex = "";
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    } else {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    }

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={dragRef}
      className={className}
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
      style={{
        ...style,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {children}
    </div>
  );
}
