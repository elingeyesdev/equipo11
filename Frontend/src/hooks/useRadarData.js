import { useState, useEffect, useCallback, useRef } from 'react';
import httpClient from '../config/httpClient';

// Helper: Carga un PNG como HTMLImageElement (0% CPU, nativo del navegador)
const _loadPng = (path, params = {}) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const timeParam = params.time ? `?time=${encodeURIComponent(params.time)}` : '';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = `${httpClient.defaults.baseURL}${path}${timeParam}`;
});

export default function useRadarData({ isParticlesActive, isCompareMode, compareIndexA, compareIndexB, isDynamicHistoricalMode }) {
  const [availableRadarDates, setAvailableRadarDates] = useState([]);
  const [globalHistoryArray, setGlobalHistoryArray] = useState([]);
  const [globalTimelineIndex, setGlobalTimelineIndex] = useState(0);
  const [scannedGrid, setScannedGrid] = useState({ status: 'idle', progress: 0, data: null });
  const [scannedGridA, setScannedGridA] = useState({ status: 'idle', data: null });
  const [scannedGridB, setScannedGridB] = useState({ status: 'idle', data: null });
  const [isFetchingRadar, setIsFetchingRadar] = useState(false);
  const [corruptedDates, setCorruptedDates] = useState(new Set());
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
      const tsStr = curr.toISOString();
      if (!corruptedDates.has(tsStr)) {
        const ts = curr.getTime();
        const diff = Math.abs(ts - nowTs);
        if (diff < minDiff) { minDiff = diff; initialIndex = index; }

        const isAvailable = availableRadarDates.some(d => {
          const d1 = new Date(d).getTime();
          const d2 = curr.getTime();
          return Math.abs(d1 - d2) < 1000 * 60 * 60;
        });

        arr.push({
          index, timestamp: tsStr,
          isPrediction: curr > now,
          isAvailable: isAvailable || curr < now,
          data: { temperatura: null }
        });
        index++;
      }
      curr = new Date(curr.getTime() + 3 * 60 * 60 * 1000);
    }
    setGlobalHistoryArray(arr);
    setGlobalTimelineIndex(prev => prev === 0 ? initialIndex : prev);
  }, [availableRadarDates, corruptedDates]);

  // ─── Descarga de 6 PNGs RGBA (Arquitectura Data Texture) ─────────
  useEffect(() => {
    if (!isParticlesActive) {
      setScannedGrid({ status: 'idle', progress: 0, data: null });
      setScannedGridA({ status: 'idle', data: null });
      setScannedGridB({ status: 'idle', data: null });
      return;
    }

    const fetchRadar = async () => {
      try {
        if (isDynamicHistoricalMode) setIsFetchingRadar(true);

        const selectedEntry = globalHistoryArray[globalTimelineIndex];
        const params = {};
        if (isDynamicHistoricalMode && selectedEntry) {
          params.time = selectedEntry.timestamp;
        }

        // Descarga de los 6 PNGs RGBA en paralelo con aislamiento de errores
        const [tempResult, visResult, rainResult, snowResult, windResult, aqiResult] =
          await Promise.allSettled([
            _loadPng('/radar/bolivia/temp/png', params),
            _loadPng('/radar/bolivia/vis/png', params),
            _loadPng('/radar/bolivia/rain/png', params),
            _loadPng('/radar/bolivia/snow/png', params),
            _loadPng('/radar/bolivia/wind/png', params),
            _loadPng('/radar/bolivia/aqi/png', params),
          ]);

        const imgData = {
          tempImg: tempResult.status === 'fulfilled' ? tempResult.value : null,
          visImg: visResult.status === 'fulfilled' ? visResult.value : null,
          rainImg: rainResult.status === 'fulfilled' ? rainResult.value : null,
          snowImg: snowResult.status === 'fulfilled' ? snowResult.value : null,
          windImg: windResult.status === 'fulfilled' ? windResult.value : null,
          aqiImg: aqiResult.status === 'fulfilled' ? aqiResult.value : null,
        };

        // Verificar que al menos una textura se cargó
        const anyLoaded = Object.values(imgData).some(v => v !== null);
        if (anyLoaded) {
          setScannedGrid({ status: 'ready', data: imgData });
          setIsFetchingRadar(false);
        } else {
          console.warn('[useRadarData] Ninguna textura PNG se cargó correctamente.');
          setIsFetchingRadar(true);
        }
      } catch (e) {
        console.error('Error fetching radar PNGs:', e);
        setIsFetchingRadar(false);
      }
    };

    fetchRadar();
  }, [isParticlesActive, isDynamicHistoricalMode, globalTimelineIndex, globalHistoryArray]);

  return {
    availableRadarDates,
    globalHistoryArray, globalTimelineIndex, setGlobalTimelineIndex,
    scannedGrid, scannedGridA, scannedGridB,
    isFetchingRadar, setCorruptedDates
  };
}
