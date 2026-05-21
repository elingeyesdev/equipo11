import { Source, Layer } from 'react-map-gl/mapbox';
import GridRadarLayer from '../GridRadarLayer/GridRadarLayer';

function WeatherOverlay({
  scannedGrid,
  currentZoom,
  particleFilters,
  isParticlesActive,
  dynamicWindLabels
}) {
  if (!isParticlesActive) return null;

  return (
    <>
      <GridRadarLayer
        scannedGrid={scannedGrid}
        currentZoom={currentZoom}
        particleFilters={particleFilters}
      />

      {particleFilters.wind && dynamicWindLabels && (
        <Source id="dynamic-wind-source" type="geojson" data={dynamicWindLabels}>
          <Layer
            id="dynamic-wind-text-layer"
            type="symbol"
            layout={{
              'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['round', ['to-number', ['get', 'wind_speed']]]], ' km/h'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-offset': [0, 0.5],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-ignore-placement': false,
              'text-padding': 20
            }}
            paint={{
              'text-color': '#a7f3d0',
              'text-halo-color': '#000000',
              'text-halo-width': 1.5
            }}
          />
        </Source>
      )}
    </>
  );
}

export default WeatherOverlay;
