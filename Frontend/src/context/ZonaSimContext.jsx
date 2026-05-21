import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSocket } from './SimulacionContext';

const ZonaSimContext = createContext(null);

export function ZonaSimProvider({ children }) {
  const socket = useSocket();
  const [activa, setActiva]           = useState(false);
  const [zonas, setZonas]             = useState([]);
  const [metrica, setMetrica]         = useState(null);
  const [unidad, setUnidad]           = useState('');
  const [escNombre, setEscNombre]     = useState('');
  const [progreso, setProgreso]       = useState(0);
  const [sesionId, setSesionId]       = useState(null);
  const [totalLecturas, setTotalLecturas] = useState(0);
  const [tiempo, setTiempo]           = useState(null);

  useEffect(() => {
    if (!socket) return;
    socket.on('zona:estado', (payload) => {
      setActiva(payload.running);
      if (!payload.running) {
        setZonas([]); setMetrica(null); setUnidad(''); setEscNombre('');
        setProgreso(0); setSesionId(null);
      } else {
        if (payload.sesionId)     setSesionId(payload.sesionId);
        if (payload.metricaClave) setMetrica(payload.metricaClave);
        if (payload.totalLecturas) setTotalLecturas(payload.totalLecturas);
      }
    });
    socket.on('zona:tick', (payload) => {
      setActiva(true);
      setZonas(payload.zonas || []);
      setMetrica(payload.metricaClave);
      setUnidad(payload.unidad || '');
      setEscNombre(payload.escenarioNombre || '');
      setProgreso(payload.progreso || 0);
      setTiempo(payload.tiempo || null);
      if (payload.sesionId) setSesionId(payload.sesionId);
    });
    return () => { socket.off('zona:estado'); socket.off('zona:tick'); };
  }, [socket]);

  const iniciar = useCallback((payload) => {
    socket?.emit('zona:iniciar', payload);
  }, [socket]);

  const detener = useCallback(() => {
    socket?.emit('zona:detener');
  }, [socket]);

  const value = useMemo(() => ({
    zonaSimActiva: activa, zonaSimZonas: zonas, zonaSimMetrica: metrica,
    zonaSimUnidad: unidad, zonaSimEscNombre: escNombre,
    zonaSimProgreso: progreso, zonaSimSesionId: sesionId,
    zonaSimTotalLecturas: totalLecturas, zonaSimTiempo: tiempo,
    iniciarZona: iniciar, detenerZona: detener,
  }), [activa, zonas, metrica, unidad, escNombre, progreso, sesionId, totalLecturas, tiempo, iniciar, detener]);

  return (
    <ZonaSimContext.Provider value={value}>
      {children}
    </ZonaSimContext.Provider>
  );
}

export function useZonaSim() {
  const ctx = useContext(ZonaSimContext);
  if (!ctx) throw new Error('useZonaSim debe usarse dentro de ZonaSimProvider');
  return ctx;
}
