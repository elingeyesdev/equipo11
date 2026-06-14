import { useState, useEffect } from 'react';
import httpClient from '../config/httpClient';

export function useForecastData(lat, lon) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (lat == null || lon == null) return;

    let cancelled = false;

    const fetchForecast = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await httpClient.get('/radar/forecast', {
          params: { lat, lon }
        });
        if (!cancelled) {
          // El backend retorna { ok: true, data: { status: 'ready', data: [...] } }
          // o { ok: true, data: [...] } dependiendo de cómo se estructure.
          // En este caso, getAiRefinedForecast retorna { status: 'ready', data: [...] }
          const payload = res.data?.data;
          if (payload && Array.isArray(payload.data)) {
            const mappedData = payload.data.map(d => {
              let t = Number(d.temperatura);
              if (t > 150) t = t - 273.15; // Kelvin to Celsius conversion
              return { ...d, temperatura: t };
            });
            setData(mappedData);
          } else if (Array.isArray(payload)) {
            const mappedData = payload.map(d => {
              let t = Number(d.temperatura);
              if (t > 150) t = t - 273.15; // Kelvin to Celsius conversion
              return { ...d, temperatura: t };
            });
            setData(mappedData);
          } else {
            setData([]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error fetching forecast data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchForecast();

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  return { data, loading, error };
}
