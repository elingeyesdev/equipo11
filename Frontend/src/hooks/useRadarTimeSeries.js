import { useState, useEffect, useRef } from 'react';
import httpClient from '../config/httpClient';
import {
  getImageDataArray,
  sampleTempBilinear,
  sampleRainBilinear,
  sampleWindBilinear,
  sampleVisibilityBilinear,
  sampleSnowBilinear,
  sampleAqiNearest,
} from '../utils/windMath';

const CONFIG_MAP = {
  temp: {
    endpoint: '/radar/bolivia/temp/png',
    sample: sampleTempBilinear,
    process: (val) => (val !== null ? val - 273.15 : null),
    unit: '°C'
  },
  rain: {
    endpoint: '/radar/bolivia/rain/png',
    sample: sampleRainBilinear,
    process: (val) => val ?? null,
    unit: 'mm'
  },
  wind: {
    endpoint: '/radar/bolivia/wind/png',
    sample: sampleWindBilinear,
    process: (val) => (val ? val.speed : null),
    unit: 'km/h'
  },
  vis: {
    endpoint: '/radar/bolivia/vis/png',
    sample: sampleVisibilityBilinear,
    process: (val) => (val !== null ? val / 1000 : null),
    unit: 'km'
  },
  snow: {
    endpoint: '/radar/bolivia/snow/png',
    sample: sampleSnowBilinear,
    process: (val) => (val ? val.fresh : null),
    unit: 'mm'
  },
  aqi: {
    endpoint: '/radar/bolivia/aqi/png',
    sample: sampleAqiNearest,
    process: (val) => val ?? null,
    unit: 'AQI'
  }
};

const _loadPng = async (path, params = {}) => {
  const timeParam = params.time ? `?time=${encodeURIComponent(params.time)}` : '';
  const url = `${httpClient.defaults.baseURL}${path}${timeParam}`;
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

  return { img, objectUrl };
};

export function useRadarTimeSeries(ciudad, timestamps, layerKey) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const objectUrlsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!ciudad || !timestamps || timestamps.length === 0 || !layerKey || !CONFIG_MAP[layerKey]) {
        if (!cancelled) {
          setSeries([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      const lng = Number(ciudad.longitude) || Number(ciudad.lng) || 0;
      const lat = Number(ciudad.latitude) || Number(ciudad.lat) || 0;
      const config = CONFIG_MAP[layerKey];
      const results = [];

      // Si son pocos timestamps, hacemos Promise.all. Si son muchos (ej 7 días), secuencial.
      if (timestamps.length <= 8) {
        const fetchPromises = timestamps.map(ts => 
          _loadPng(config.endpoint, { time: ts }).then(res => ({ ts, res })).catch(err => ({ ts, err }))
        );
        
        const fetched = await Promise.all(fetchPromises);
        
        for (const item of fetched) {
          if (cancelled) break;
          
          if (item.err) {
            results.push({ timestamp: item.ts, value: null, unit: config.unit });
            continue;
          }
          
          objectUrlsRef.current.push(item.res.objectUrl);
          const data = getImageDataArray(item.res.img);
          const rawVal = config.sample(data, lng, lat);
          const finalVal = config.process(rawVal);
          
          results.push({ timestamp: item.ts, value: finalVal, unit: config.unit });
        }
      } else {
        // Secuencial para evitar saturar el navegador si son muchos requests
        for (const ts of timestamps) {
          if (cancelled) break;
          
          try {
            const res = await _loadPng(config.endpoint, { time: ts });
            objectUrlsRef.current.push(res.objectUrl);
            const data = getImageDataArray(res.img);
            const rawVal = config.sample(data, lng, lat);
            const finalVal = config.process(rawVal);
            results.push({ timestamp: ts, value: finalVal, unit: config.unit });
          } catch (err) {
            results.push({ timestamp: ts, value: null, unit: config.unit });
          }
          
          // Pequeño delay de 100ms
          await new Promise(r => setTimeout(r, 100));
        }
      }

      if (!cancelled) {
        // Retornar series ordenada por timestamp ascendente
        results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setSeries(results);
        setLoading(false);
      }
    };

    run().catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Error en serie temporal radar');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, [ciudad, timestamps, layerKey]);

  return { series, loading, error };
}
