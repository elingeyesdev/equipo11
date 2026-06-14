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

export function useRadarSampling(selectedTime, ciudades) {
  const [sampledData, setSampledData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const objectUrlsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedTime || !ciudades || ciudades.length === 0) {
        if (!cancelled) {
          setSampledData([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      const params = { time: selectedTime };

      const [tempResult, rainResult, windResult, visResult, snowResult, aqiResult] =
        await Promise.allSettled([
          _loadPng('/radar/bolivia/temp/png', params),
          _loadPng('/radar/bolivia/rain/png', params),
          _loadPng('/radar/bolivia/wind/png', params),
          _loadPng('/radar/bolivia/vis/png', params),
          _loadPng('/radar/bolivia/snow/png', params),
          _loadPng('/radar/bolivia/aqi/png', params),
        ]);

      if (cancelled) {
        cleanupUrls();
        return;
      }

      const results = [tempResult, rainResult, windResult, visResult, snowResult, aqiResult];

      const urls = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') urls.push(r.value.objectUrl);
      });
      objectUrlsRef.current = urls;

      const decode = (result) => {
        if (result.status !== 'fulfilled') return null;
        return getImageDataArray(result.value.img);
      };

      const tempData = decode(tempResult);
      const rainData = decode(rainResult);
      const windData = decode(windResult);
      const visData = decode(visResult);
      const snowData = decode(snowResult);
      const aqiData = decode(aqiResult);

      const resultado = ciudades.map((ciudad) => {
        const lng = Number(ciudad.longitude) || Number(ciudad.lng) || 0;
        const lat = Number(ciudad.latitude) || Number(ciudad.lat) || 0;

        const tempK = sampleTempBilinear(tempData, lng, lat);
        const rain = sampleRainBilinear(rainData, lng, lat);
        const wind = sampleWindBilinear(windData, lng, lat);
        const vis = sampleVisibilityBilinear(visData, lng, lat);
        const snow = sampleSnowBilinear(snowData, lng, lat);
        const aqi = sampleAqiNearest(aqiData, lng, lat);

        return {
          nombre: ciudad.name || ciudad.nombre || 'Desconocido',
          lat,
          lng,
          temp: tempK !== null ? tempK - 273.15 : null,
          rain: rain ?? null,
          windSpeed: wind ? wind.speed : null,
          visibility: vis ?? null,
          snowAccum: snow ? snow.accumulated : null,
          snowFresh: snow ? snow.fresh : null,
          aqi: aqi ?? null,
        };
      });

      if (!cancelled) {
        setSampledData(resultado);
        setLoading(false);
      }
    };

    run().catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Error al muestrear datos radar');
        setLoading(false);
      }
    });

    const cleanupUrls = () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };

    return () => {
      cancelled = true;
      cleanupUrls();
    };
  }, [selectedTime, ciudades]);

  return { sampledData, loading, error };
}
