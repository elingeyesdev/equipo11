import { useState, useEffect } from 'react';
import httpClient from '../config/httpClient';

export function useMultiForecastData(cities) {
  const [dataMap, setDataMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cities || cities.length === 0) return;

    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const promises = cities.map(city => 
          httpClient.get('/radar/forecast', {
            params: { lat: city.latitude, lon: city.longitude }
          }).then(res => {
            const payload = res.data?.data;
            
            // La API devuelve res.data = { ok: true, data: { status: 'ready', data: ... } }
            // O directamente la data
            const innerData = payload?.data || payload;
            let hourlyData = [];
            
            // Si es el nuevo formato enriquecido
            if (innerData && innerData.hourly) {
              hourlyData = innerData.hourly;
            } 
            // Fallback al formato viejo
            else if (innerData && Array.isArray(innerData)) {
              hourlyData = innerData;
            }
            
            return {
              cityName: city.nombre,
              data: hourlyData.map(d => {
                let t = Number(d.temperatura);
                if (t > 150) t = t - 273.15; // Kelvin to Celsius conversion (old fallback)
                
                let r = Number(d.rain);
                if (isNaN(r)) r = 0;
                
                return { 
                  ...d, 
                  temperatura: t,
                  rain: r
                };
              }),
              fullData: innerData // pasamos el objeto {current, hourly, daily} directamente
            };
          })
        );

        const results = await Promise.all(promises);
        
        if (!cancelled) {
          const newMap = {};
          results.forEach(res => {
            newMap[res.cityName] = res.data; // Mantenemos res.data como array horario para compatibilidad
            newMap[`${res.cityName}_full`] = res.fullData; // El objeto nuevo completo
          });
          setDataMap(newMap);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error fetching multi forecast data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(cities)]); // Stringify to avoid infinite loops if array ref changes

  return { dataMap, loading, error };
}

