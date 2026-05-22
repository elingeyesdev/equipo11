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
          citiesData.map((city) => (
            <Marker
              key={`marker-${idPrefix}-${city.id}`}
              longitude={city.longitude} latitude={city.latitude}
              anchor="bottom"
              onClick={async (e) => { e.originalEvent.stopPropagation(); onCityClick(city); }}
            >
              <div className={`custom-marker sensor-iot-marker${injectedCityId === city.id ? ' custom-marker--injected' : ''}`}>
                <span role="img" aria-label="sensor" style={{ fontSize: '20px', filter: 'drop-shadow(0 0 4px rgba(0,229,255,0.8))' }}>📡</span>
              </div>
            </Marker>
          ))
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
