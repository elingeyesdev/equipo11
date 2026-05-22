import { useState, useEffect } from 'react';
import { getSensoresIoT } from '../utils/weatherApi';
import { FALLBACK_DATA } from '../data/fallbackData';

export default function useSensors({ scannedGrid, simulatedCities, isParticlesActive, particleFilters }) {
  const [iotSensors, setIotSensors] = useState([]);
  const [iotLoading, setIotLoading] = useState(true);
  const [dynamicWindLabels, setDynamicWindLabels] = useState(null);

  useEffect(() => {
    const loadSensors = async () => {
      setIotLoading(true);
      const data = await getSensoresIoT();
      if (data && data.length > 0) setIotSensors(data);
      setIotLoading(false);
    };
    loadSensors();
    const interval = setInterval(loadSensors, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!scannedGrid?.data || !isParticlesActive || !particleFilters.wind) return;

    let activeCities = simulatedCities.length > 0 ? simulatedCities : (iotSensors.length > 0 ? iotSensors : FALLBACK_DATA);

    const newFeatures = activeCities.map((city) => {
      let nearestCell = null;
      let minDist = Infinity;
      const lng = city.longitude;
      const lat = city.latitude;

      const roughGrid = scannedGrid.data.filter(c => Math.abs(c.latitud - lat) < 1.5 && Math.abs(c.longitud - lng) < 1.5);
      const searchSpace = roughGrid.length > 0 ? roughGrid : scannedGrid.data;

      searchSpace.forEach(cell => {
        const dist = Math.hypot(cell.latitud - lat, cell.longitud - lng);
        if (dist < minDist) { minDist = dist; nearestCell = cell; }
      });

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { name: city.name || city.ciudad || 'Desconocido', wind_speed: nearestCell ? nearestCell.wind_speed : 0 }
      };
    });

    setDynamicWindLabels({ type: 'FeatureCollection', features: newFeatures });
  }, [scannedGrid, simulatedCities, iotSensors, isParticlesActive, particleFilters.wind]);

  const citiesData = simulatedCities.length > 0 ? simulatedCities : (iotSensors.length > 0 ? iotSensors : FALLBACK_DATA);

  return { iotSensors, iotLoading, dynamicWindLabels, citiesData };
}
