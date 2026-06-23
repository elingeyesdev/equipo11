import { useState, useEffect } from 'react';
import httpClient from '../config/httpClient';

export function useForecastData(lat, lon) {
  const [data, setData] = useState(null); // Ahora es un objeto {current, hourly, daily}
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
          const payload = res.data?.data;
          if (payload && payload.hourly && payload.current && payload.daily) {
            // El backend ya lo retorna en la estructura deseada
            setData(payload);
          } else {
            setData(null);
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

