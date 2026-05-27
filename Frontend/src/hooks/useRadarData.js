import { useState, useEffect, useCallback, useRef } from 'react';
import httpClient from '../config/httpClient';

export default function useRadarData({ isParticlesActive, isCompareMode, compareIndexA, compareIndexB, isDynamicHistoricalMode }) {
  const [availableRadarDates, setAvailableRadarDates] = useState([]);
  const [globalHistoryArray, setGlobalHistoryArray] = useState([]);
  const [globalTimelineIndex, setGlobalTimelineIndex] = useState(0);
  const [scannedGrid, setScannedGrid] = useState({ status: 'idle', progress: 0, data: [] });
  const [scannedGridA, setScannedGridA] = useState({ status: 'idle', data: [] });
  const [scannedGridB, setScannedGridB] = useState({ status: 'idle', data: [] });
  const [isFetchingRadar, setIsFetchingRadar] = useState(false);
  const hasSetInitialIndex = useRef(false);

  // Fetch available dates from backend
  const fetchAvailableDates = useCallback(async () => {
    try {
      const { data } = await httpClient.get('/radar/available-dates');
      setAvailableRadarDates(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      console.error('Error fetching available dates', e);
    }
  }, []);

  useEffect(() => {
    fetchAvailableDates();
    const interval = setInterval(fetchAvailableDates, 30000);
    return () => clearInterval(interval);
  }, [fetchAvailableDates]);

  // Generate global history array for the last 3 days + next 24h
  useEffect(() => {
    const arr = [];
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 3);
    start.setUTCHours(0, 0, 0, 0);
    const futureEnd = new Date(now);
    futureEnd.setUTCDate(futureEnd.getUTCDate() + 1);
    futureEnd.setUTCHours(23, 0, 0, 0);

    let index = 0;
    let curr = start;
    let initialIndex = 0;
    const nowTs = now.getTime();
    let minDiff = Infinity;

    while (curr <= futureEnd) {
      const ts = curr.getTime();
      const diff = Math.abs(ts - nowTs);
      if (diff < minDiff) { minDiff = diff; initialIndex = index; }

      const isAvailable = availableRadarDates.some(d => {
        const d1 = new Date(d).getTime();
        const d2 = curr.getTime();
        return Math.abs(d1 - d2) < 1000 * 60 * 60;
      });

      arr.push({
        index, timestamp: curr.toISOString(),
        isPrediction: curr > now,
        isAvailable: isAvailable || curr < now,
        data: { temperatura: null }
      });

      curr = new Date(curr.getTime() + 3 * 60 * 60 * 1000);
      index++;
    }
    setGlobalHistoryArray(arr);
    setGlobalTimelineIndex(prev => prev === 0 ? initialIndex : prev);
  }, [availableRadarDates]);

  // Radar fetch effect
  useEffect(() => {
    let intervalId;
    if (isParticlesActive) {
      const fetchRadar = async () => {
        try {
          if (isDynamicHistoricalMode) setIsFetchingRadar(true);

          if (isCompareMode) {
            const fetchSide = async (timeIndex, setter) => {
              const entry = globalHistoryArray[timeIndex];
              if (!entry) return;
              const path = entry.isPrediction ? '/radar/prediction' : '/radar/bolivia';
              const { data: resp } = await httpClient.get(path, { params: { time: entry.timestamp } });
              const r = resp.data;
              setter(r);
              return r.status;
            };
            const [statusA, statusB] = await Promise.all([
              fetchSide(compareIndexA ?? globalTimelineIndex, setScannedGridA),
              fetchSide(compareIndexB ?? globalTimelineIndex, setScannedGridB)
            ]);
            if (statusA === 'ready' && statusB === 'ready') {
              clearInterval(intervalId);
              setIsFetchingRadar(false);
            }
          } else {
            let path = '/radar/bolivia';
            const selectedEntry = globalHistoryArray[globalTimelineIndex];
            const params = {};
            if (isDynamicHistoricalMode && selectedEntry) {
              if (selectedEntry.isPrediction) path = '/radar/prediction';
              params.time = selectedEntry.timestamp;
            }
            const { data: resp } = await httpClient.get(path, { params });
            const res = resp.data;
            
            // DEBUG SENSOR: Verificar llaves del JSON crudo
            if (res && res.data && res.data.length > 0) {
              res.data.forEach(cell => {
                if (cell.temperatura !== undefined && cell.temperatura !== null) {
                  const tempVal = parseFloat(cell.temperatura);
                  cell.temperatura = isNaN(tempVal) ? null : tempVal;
                }
              });
              console.log("🔍 Sonda GFS Backend (Primera Celda):", res.data[0]);
            } else if (Array.isArray(res) && res.length > 0) {
              res.forEach(cell => {
                if (cell.temperatura !== undefined && cell.temperatura !== null) {
                  const tempVal = parseFloat(cell.temperatura);
                  cell.temperatura = isNaN(tempVal) ? null : tempVal;
                }
              });
              console.log("🔍 Sonda GFS Backend (Primera Celda):", res[0]);
            }

            setScannedGrid(res);
            if (res && res.status === 'ready') {
              clearInterval(intervalId);
              setIsFetchingRadar(false);
            } else {
              setIsFetchingRadar(true);
            }
          }
        } catch (e) {
          console.error('Error fetching radar:', e);
          setIsFetchingRadar(false);
        }
      };
      fetchRadar();
      intervalId = setInterval(fetchRadar, 1000);
    } else {
      setScannedGrid({ status: 'idle', progress: 0, data: [] });
      setScannedGridA({ status: 'idle', data: [] });
      setScannedGridB({ status: 'idle', data: [] });
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isParticlesActive, isCompareMode, isDynamicHistoricalMode, globalTimelineIndex, compareIndexA, compareIndexB, globalHistoryArray]);

  return {
    availableRadarDates,
    globalHistoryArray, globalTimelineIndex, setGlobalTimelineIndex,
    scannedGrid, scannedGridA, scannedGridB,
    isFetchingRadar
  };
}
