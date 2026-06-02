import { useRef, useCallback, useState } from 'react';
import httpClient from '../config/httpClient';

/**
 * useTimeBuffer — Gestor de pre-carga masiva (AOT Preloading) para fotogramas de la línea de tiempo.
 *
 * Arquitectura PNG-Only + Mass Preloading:
 *  Al activar el historial, descarga TODAS las fechas disponibles concurrentemente.
 *  Las guarda en un Map permanente. No hay desalojo (LRU) para asegurar 60FPS.
 */

const _loadPngFrame = async (basePath, timestamp) => {
  try {
    const url = `${httpClient.defaults.baseURL}${basePath}?time=${encodeURIComponent(timestamp)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Bad status: ${response.status}`);
    
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image decode error'));
      img.src = objectUrl;
    });
    
    return img;
  } catch (error) {
    throw error;
  }
};

export default function useTimeBuffer(globalHistoryArray, setCorruptedDates) {
  const buffer = useRef(new Map()); // index -> { tempImg, visImg, rainImg, snowImg, windImg, aqiImg }
  const inFlight = useRef(false);
  const isPreloaded = useRef(false);
  const [isPreloading, setIsPreloading] = useState(false);

  const preloadAll = useCallback(async () => {
    if (!globalHistoryArray || globalHistoryArray.length === 0) return;
    if (isPreloaded.current || inFlight.current) return;

    inFlight.current = true;
    setIsPreloading(true);

    try {
      // Create an array of promises for all frames
      const promises = globalHistoryArray.map(async (entry, fetchIndex) => {
        if (!entry || buffer.current.has(fetchIndex)) return { fetchIndex, valid: true, timestamp: entry?.timestamp };

        const ts = entry.timestamp;
        
        // Descargar las 6 texturas PNG en paralelo para este frame
        const [temp, vis, rain, snow, wind, aqi] = await Promise.allSettled([
          _loadPngFrame('/radar/bolivia/temp/png', ts),
          _loadPngFrame('/radar/bolivia/vis/png', ts),
          _loadPngFrame('/radar/bolivia/rain/png', ts),
          _loadPngFrame('/radar/bolivia/snow/png', ts),
          _loadPngFrame('/radar/bolivia/wind/png', ts),
          _loadPngFrame('/radar/bolivia/aqi/png', ts),
        ]);

        const tempVal = temp.status === 'fulfilled' ? temp.value : null;

        buffer.current.set(fetchIndex, {
          tempImg: tempVal,
          visImg: vis.status === 'fulfilled' ? vis.value : null,
          rainImg: rain.status === 'fulfilled' ? rain.value : null,
          snowImg: snow.status === 'fulfilled' ? snow.value : null,
          windImg: wind.status === 'fulfilled' ? wind.value : null,
          aqiImg: aqi.status === 'fulfilled' ? aqi.value : null,
        });

        return { fetchIndex, valid: tempVal !== null, timestamp: ts };
      });

      // Esperar a que todos los frames se descarguen
      const results = await Promise.allSettled(promises);
      
      // Filtrar frames corruptos
      if (setCorruptedDates) {
        const corruptedTimestamps = [];
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value && !res.value.valid) {
            corruptedTimestamps.push(res.value.timestamp);
          }
        });
        if (corruptedTimestamps.length > 0) {
          setCorruptedDates(prev => {
            const nextSet = new Set(prev);
            corruptedTimestamps.forEach(ts => nextSet.add(ts));
            return nextSet;
          });
        }
      }

      isPreloaded.current = true;
    } catch (e) {
      console.error('Error during mass preloading:', e);
    } finally {
      inFlight.current = false;
      setIsPreloading(false);
    }
  }, [globalHistoryArray]);

  /** Obtiene el fotograma completo (6 imágenes PNG) */
  const getFrame = useCallback((index) => {
    return buffer.current.get(index) || null;
  }, []);

  /** Verifica si el fotograma está listo */
  const isFrameReady = useCallback((index) => {
    return buffer.current.has(index);
  }, []);

  return { preloadAll, getFrame, isFrameReady, isPreloading };
}
