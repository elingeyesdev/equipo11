/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from 'react';
import { getSensoresIoT } from '../utils/weatherApi';
import { FALLBACK_DATA } from '../data/fallbackData';
import { getImageDataArray, sampleWindBilinear } from '../utils/windMath';

export default function useSensors({ scannedGrid, simulatedCities, isParticlesActive, particleFilters, trigger }) {
  const [iotSensors, setIotSensors] = useState([]);
  const [iotLoading, setIotLoading] = useState(true);
  const [dynamicWindLabels, setDynamicWindLabels] = useState(null);

  useEffect(() => {
    const loadSensors = async (isInitial = false) => {
      if (isInitial) setIotLoading(true);
      const data = await getSensoresIoT();
      if (data) setIotSensors(data);
      if (isInitial) setIotLoading(false);
    };
    loadSensors(true);
    const interval = setInterval(() => loadSensors(false), 10 * 1000);
    return () => clearInterval(interval);
  }, [trigger]);

  // Extraer pixel data del wind PNG una sola vez
  const windPixelData = useMemo(() => {
    if (!scannedGrid?.data?.windImg) return null;
    return getImageDataArray(scannedGrid.data.windImg);
  }, [scannedGrid]);

  useEffect(() => {
    if (!windPixelData || !isParticlesActive || !particleFilters.wind) return;

    let activeCities = simulatedCities.length > 0 ? simulatedCities : (iotSensors.length > 0 ? iotSensors : FALLBACK_DATA);

    const newFeatures = activeCities.map((city) => {
      const lng = city.longitude;
      const lat = city.latitude;

      // Leer la velocidad del viento desde la textura PNG
      const wind = sampleWindBilinear(windPixelData, lng, lat);

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { name: city.name || city.ciudad || 'Desconocido', wind_speed: wind.speed }
      };
    });

    setDynamicWindLabels({ type: 'FeatureCollection', features: newFeatures });
  }, [windPixelData, simulatedCities, iotSensors, isParticlesActive, particleFilters.wind]);

  const citiesData = simulatedCities.length > 0 ? simulatedCities : (iotSensors.length > 0 ? iotSensors : FALLBACK_DATA);

  return { iotSensors, iotLoading, dynamicWindLabels, citiesData };
}
