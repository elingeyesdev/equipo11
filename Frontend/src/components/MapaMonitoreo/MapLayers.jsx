import { Fragment } from 'react';
import { Marker, Source, Layer } from 'react-map-gl/mapbox';
import VoronoiLayer from '../../pages/MapaMonitoreo/layers/VoronoiLayer';
import ChoroplethLayer from '../../pages/MapaMonitoreo/layers/ChoroplethLayer';
import MarkersLayer from '../../pages/MapaMonitoreo/layers/MarkersLayer';
import WeatherOverlay from './WeatherOverlay';

export default function MapLayers({
  idPrefix,
  fronterasSeleccionadas, zonaSimZonas, isSimMode, zonaSimActiva,
  isHeatmapActive, heatmapMetric, umbrales, citiesData, activeUmbralFilter,
  isChoroplethActive,
  showSensors, unidades, currentZoom, injectedCityId,
  isParticlesActive, particleFilters, dynamicWindLabels, scannedGrid,
  onCityClick,
}) {
  return (
    <>
      {(isSimMode || zonaSimActiva) && fronterasSeleccionadas.map((frontera, idx) => {
        const simData = zonaSimZonas.find(z => z.nombre === frontera.nombre);
        const color = simData?.color || (idx === 0 ? '#38bdf8' : '#a855f7');
        return (
          <Fragment key={`frontera-${idPrefix}-${idx}`}>
            <Source id={`frontera-source-${idPrefix}-${idx}`} type="geojson" data={frontera.geojson}>
              <Layer id={`frontera-fill-${idPrefix}-${idx}`} type="fill" paint={{ 'fill-color': color, 'fill-opacity': simData ? 0.3 : 0.2 }} />
              <Layer id={`frontera-line-${idPrefix}-${idx}`} type="line" paint={{ 'line-color': color, 'line-width': 2 }} />
            </Source>
          </Fragment>
        );
      })}

      {isHeatmapActive && (
        <VoronoiLayer metrica={heatmapMetric} umbrales={umbrales} cities={citiesData} activeFilter={activeUmbralFilter} />
      )}
      {isChoroplethActive && (
        <ChoroplethLayer metrica={heatmapMetric} umbrales={umbrales} cities={citiesData} activeFilter={activeUmbralFilter} />
      )}

      {showSensors && (
        isHeatmapActive ? (
          <MarkersLayer
            cities={citiesData} metrica={heatmapMetric} umbrales={umbrales}
            activeFilter={activeUmbralFilter} unidad={unidades[heatmapMetric]}
            currentZoom={currentZoom} onCityClick={onCityClick}
          />
        ) : (
          citiesData.map((city) => {
            const isCustom = !!city.es_custom;
            return (
              <Marker
                key={`marker-${idPrefix}-${city.id}`}
                longitude={city.longitude} latitude={city.latitude}
                anchor="bottom"
                onClick={async (e) => { e.originalEvent.stopPropagation(); onCityClick(city); }}
              >
                <div className={`custom-marker ${isCustom ? 'sensor-custom-marker' : 'sensor-iot-marker'}${injectedCityId === city.id ? ' custom-marker--injected' : ''}`}>
                  <span role="img" aria-label="sensor" style={{ fontSize: isCustom ? '22px' : '20px', filter: isCustom ? 'drop-shadow(0 0 6px rgba(168,85,247,0.8))' : 'drop-shadow(0 0 4px rgba(0,229,255,0.8))' }}>
                    {isCustom ? (
                      <svg width="20" height="20" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                        <path d="M8.58 16.14a6 6 0 0 1 6.84 0" />
                        <circle cx="12" cy="20" r="1.5" fill="#a855f7" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 12a10 10 0 0 1 17-10"/><path d="M9 12a3 3 0 0 1 4-2"/><path d="M6 12a6 6 0 0 1 10-5"/><circle cx="12" cy="12" r="2"/></svg>
                    )}
                  </span>
                </div>
              </Marker>
            );
          })
        )
      )}

      <WeatherOverlay
        scannedGrid={scannedGrid} currentZoom={currentZoom}
        particleFilters={particleFilters} isParticlesActive={isParticlesActive}
        dynamicWindLabels={dynamicWindLabels}
      />
    </>
  );
}
