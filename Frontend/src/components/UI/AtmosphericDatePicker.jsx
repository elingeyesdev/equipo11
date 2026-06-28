import React, { useState, useEffect, useRef } from 'react';
import './AtmosphericDatePicker.css';

// Techo temporal absoluto del sistema (Año 2026, Mes 6 [Julio], Día 5)
const HARD_MAX_DATE = new Date(2026, 6, 5, 23, 59, 59);

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FULL_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const YEARS = [2024, 2025, 2026];

const VALIDATED_DAYS_CACHE = new Map();

const AtmosphericDatePicker = ({ selectedDate, onChange, metric }) => {
  const [isOpen, setIsOpen] = useState(false); // Inicia estrictamente OCULTO por defecto
  const [viewMode, setViewMode] = useState('DAYS'); // 'DAYS' | 'MONTHS' | 'YEARS'
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date(2026, 5, 28));
  
  const containerRef = useRef(null);
  const [cacheTick, setCacheTick] = useState(0);

  // Validación de disponibilidad de días (HEAD cache)
  useEffect(() => {
    if (viewMode !== 'DAYS' || !metric) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    
    const yyyy = year;
    const mm = String(month + 1).padStart(2, '0');

    const checks = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dd = String(i).padStart(2, '0');
      const cacheKey = `${metric}_${yyyy}_${mm}_${dd}`;
      
      if (!VALIDATED_DAYS_CACHE.has(cacheKey)) {
        const url = `http://100.73.66.22:1762/${metric}/${yyyy}/${mm}/${yyyy}${mm}${dd}_1200.png`;
        checks.push(
          fetch(url, { method: 'HEAD' })
            .then(res => {
              VALIDATED_DAYS_CACHE.set(cacheKey, res.ok);
            })
            .catch(() => {
              VALIDATED_DAYS_CACHE.set(cacheKey, false);
            })
        );
      }
    }

    if (checks.length > 0) {
      Promise.allSettled(checks).then(() => {
        setCacheTick(t => t + 1); // Trigger re-render
      });
    }
  }, [currentDate.getFullYear(), currentDate.getMonth(), viewMode, metric]);

  // Sync internal state if prop changes
  useEffect(() => {
    if (selectedDate) {
      setCurrentDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  // Click Outside para cerrar popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef]);

  const notifyChange = (newDate) => {
    setCurrentDate(newDate);
    if (onChange) {
      // YYYY-MM-DD
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    }
  };

  const handleDayClick = (day) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    notifyChange(newDate);
    setIsOpen(false); // Cierra automáticamente al seleccionar el día
  };

  const handleMonthClick = (monthIndex) => {
    const newDate = new Date(currentDate.getFullYear(), monthIndex, currentDate.getDate());
    notifyChange(newDate);
    setViewMode('DAYS');
  };

  const handleYearClick = (year) => {
    const newDate = new Date(year, currentDate.getMonth(), currentDate.getDate());
    notifyChange(newDate);
    setViewMode('MONTHS');
  };

  const shiftDay = (delta) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + delta);
    notifyChange(newDate);
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const day = new Date(year, month, 1).getDay();
    // Convert to Monday = 0, Sunday = 6
    return day === 0 ? 6 : day - 1;
  };

  const renderDaysView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="atm-cal-day-empty"></div>);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const cellDate = new Date(year, month, i, 23, 59, 59);
      const isBeyondCeiling = cellDate > HARD_MAX_DATE;
      const yyyy = year;
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const cacheKey = `${metric}_${yyyy}_${mm}_${dd}`;
      
      const isMissingData = VALIDATED_DAYS_CACHE.get(cacheKey) === false;
      const isDayDisabled = isBeyondCeiling || isMissingData;
      
      const isSelected = i === currentDate.getDate();

      days.push(
        <button
          key={`day-${i}`}
          disabled={isBeyondCeiling}
          className={`atm-cal-day ${isSelected ? 'selected' : ''} ${isBeyondCeiling ? 'opacity-30 cursor-not-allowed text-slate-600 hover:bg-transparent' : ''}`}
          onClick={() => !isBeyondCeiling && handleDayClick(i)}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="atm-cal-body">
        <div className="atm-cal-weekdays">
          <span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sa</span><span>Do</span>
        </div>
        <div className="atm-cal-days-grid">
          {days}
        </div>
      </div>
    );
  };

  const renderMonthsView = () => {
    return (
      <div className="atm-cal-body">
        <div className="atm-cal-months-grid">
          {MONTHS.map((monthStr, idx) => {
            const isBeyondCeiling = currentDate.getFullYear() === 2026 && idx > 6;
            
            return (
              <button
                key={monthStr}
                disabled={isBeyondCeiling}
                className={`atm-cal-month ${currentDate.getMonth() === idx ? 'selected' : ''} ${isBeyondCeiling ? 'opacity-30 cursor-not-allowed text-slate-600 hover:bg-slate-800 border-slate-800' : ''}`}
                onClick={() => !isBeyondCeiling && handleMonthClick(idx)}
              >
                {monthStr}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearsView = () => {
    return (
      <div className="atm-cal-body">
        <div className="atm-cal-years-col">
          {YEARS.map(year => (
            <button
              key={year}
              className={`atm-cal-year ${currentDate.getFullYear() === year ? 'selected' : ''}`}
              onClick={() => handleYearClick(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const isNextDayDisabled = currentDate >= new Date(2026, 6, 5, 0, 0, 0);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Botón Disparador (Siempre visible) */}
      <button 
        className="flex items-center gap-2 bg-slate-900 bg-opacity-95 border border-slate-700 backdrop-blur-md text-white rounded-lg px-4 py-2 hover:bg-slate-800 transition-colors shadow-md map-overlay-select font-semibold"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="w-4 h-4 text-cyan-400 inline-block mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect width="18" height="18" x="3" y="4" strokeWidth="2" rx="2" ry="2"/>
          <line x1="16" x2="16" y1="2" y2="6" strokeWidth="2"/>
          <line x1="8" x2="8" y1="2" y2="6" strokeWidth="2"/>
          <line x1="3" x2="21" y1="10" y2="10" strokeWidth="2"/>
        </svg>
        {currentDate.getDate()} de {FULL_MONTHS[currentDate.getMonth()]}, {currentDate.getFullYear()}
      </button>

      {/* Caja del Calendario HUD (Renderizado condicional) */}
      {isOpen && (
        <div className="absolute top-12 left-0 z-50 atm-datepicker-container bg-slate-900 bg-opacity-95 border border-slate-700 backdrop-blur-md text-white rounded-lg shadow-2xl p-4 w-72 mt-1">
          
          {viewMode === 'DAYS' && (
            <div className="atm-cal-header flex justify-between items-center mb-4">
              <button className="atm-cal-nav-btn text-slate-400 hover:text-white" onClick={() => shiftDay(-1)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="atm-cal-title flex gap-2">
                <button className="text-cyan-400 hover:text-cyan-300 font-semibold" onClick={() => setViewMode('MONTHS')}>
                  {FULL_MONTHS[currentDate.getMonth()]}
                </button>
                <button className="text-slate-200 hover:text-white font-semibold" onClick={() => setViewMode('YEARS')}>
                  {currentDate.getFullYear()}
                </button>
              </div>
              <button 
                className={`atm-cal-nav-btn ${isNextDayDisabled ? 'text-slate-600 opacity-50 cursor-not-allowed' : 'text-slate-400 hover:text-white'}`} 
                disabled={isNextDayDisabled}
                onClick={() => !isNextDayDisabled && shiftDay(1)}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          )}

          {viewMode === 'MONTHS' && (
            <div className="atm-cal-header flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <span className="font-semibold text-slate-200">Mes:</span>
              <button 
                onClick={() => setViewMode('YEARS')} 
                className="text-cyan-400 hover:underline px-2 py-1 bg-slate-800 rounded font-bold"
              >
                {currentDate.getFullYear()}
              </button>
              <button className="text-sm text-cyan-400 hover:text-cyan-300" onClick={() => setViewMode('DAYS')}>Volver</button>
            </div>
          )}

          {viewMode === 'YEARS' && (
            <div className="atm-cal-header flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <span className="font-semibold text-slate-200">Seleccionar Año</span>
              <button className="text-sm text-cyan-400 hover:text-cyan-300" onClick={() => setViewMode('DAYS')}>Volver</button>
            </div>
          )}

          {viewMode === 'DAYS' && renderDaysView()}
          {viewMode === 'MONTHS' && renderMonthsView()}
          {viewMode === 'YEARS' && renderYearsView()}

        </div>
      )}
    </div>
  );
};

export default AtmosphericDatePicker;
