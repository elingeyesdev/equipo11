import { createContext, useContext, useState, useMemo } from 'react';

const MapVisualsContext = createContext(null);

export function MapVisualsProvider({ children }) {
  const [isHeatmapActive, setIsHeatmapActive] = useState(false);
  const [isChoroplethActive, setIsChoroplethActive] = useState(false);
  const [heatmapMetric, setHeatmapMetric] = useState('aqi');
  const [showSensors, setShowSensors] = useState(true);
  const [isParticlesActive, setIsParticlesActive] = useState(false);
  const [particleFilters, setParticleFilters] = useState({ rain: false, snow: false, wind: false, fog: false, temp: false });
  const [snowMapType, setSnowMapType] = useState('depth'); // 'depth' o 'fresh'
  const [tempUnit, setTempUnit] = useState('C'); // 'C', 'F' o 'K'
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [isDynamicHistoricalMode, setIsDynamicHistoricalMode] = useState(false);

  const value = useMemo(() => ({
    isHeatmapActive, setIsHeatmapActive,
    isChoroplethActive, setIsChoroplethActive,
    heatmapMetric, setHeatmapMetric,
    showSensors, setShowSensors,
    isParticlesActive, setIsParticlesActive,
    particleFilters, setParticleFilters,
    snowMapType, setSnowMapType,
    tempUnit, setTempUnit,
    isHistoricalMode, setIsHistoricalMode,
    isDynamicHistoricalMode, setIsDynamicHistoricalMode,
  }), [isHeatmapActive, isChoroplethActive, heatmapMetric, showSensors, isParticlesActive, particleFilters, snowMapType, tempUnit, isHistoricalMode, isDynamicHistoricalMode]);

  return (
    <MapVisualsContext.Provider value={value}>
      {children}
    </MapVisualsContext.Provider>
  );
}

export function useMapVisuals() {
  const ctx = useContext(MapVisualsContext);
  if (!ctx) throw new Error('useMapVisuals debe usarse dentro de MapVisualsProvider');
  return ctx;
}
