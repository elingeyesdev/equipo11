import { useState, useEffect } from 'react';
import httpClient from '../config/httpClient';
import { getHistoricalWeatherAtLocation } from '../utils/weatherApi';

export default function useCityHistory({ isHistoricalMode, selectedCity }) {
  const [cityHistoryArray, setCityHistoryArray] = useState([]);
  const [timelineIndex, setTimelineIndex] = useState(0);

  useEffect(() => {
    if (isHistoricalMode && selectedCity) {
      const fetchHistory = async () => {
        try {
          const { data } = await httpClient.get('/historial', { cacheTTL: false });
          const allData = data.data || [];
          if (allData && allData.length > 0) {
            const fallbackMapped = allData.map((snapshot, idx) => {
              const cData = snapshot.cities.find(
                c => c.name?.toLowerCase() === selectedCity.name?.toLowerCase()
              );
              return { index: idx, timestamp: snapshot.timestamp, data: cData ? cData.data : null };
            }).filter(e => e.data !== null);

            if (fallbackMapped.length > 0) {
              setCityHistoryArray(fallbackMapped);
              setTimelineIndex(fallbackMapped.length - 1);
              return;
            }
          }
        } catch (err) {
          console.warn('[Histórico] BD local falló, usando Open-Meteo:', err.message);
        }

        try {
          const apiData = await getHistoricalWeatherAtLocation(selectedCity.latitude, selectedCity.longitude);
          if (apiData && apiData.length > 0) {
            setCityHistoryArray(apiData);
            setTimelineIndex(apiData.length - 1);
          } else {
            setCityHistoryArray([]);
          }
        } catch (err) {
          console.error('Historical Fallback failed', err);
          setCityHistoryArray([]);
        }
      };
      fetchHistory();
    }
  }, [isHistoricalMode, selectedCity]);

  return { cityHistoryArray, timelineIndex, setTimelineIndex };
}
