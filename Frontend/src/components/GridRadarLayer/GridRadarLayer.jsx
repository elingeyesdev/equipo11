import { useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/mapbox';
import './GridRadarLayer.css';

const getWeatherType = (code) => {
  if (code == null || code === 0) return null;
  // Lluvia
  if ((code >= 51 && code <= 69) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
  // Nieve
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  // Niebla
  if (code === 45 || code === 48) return 'fog';
  return null;
};

const getWeatherColor = (type) => {
  if (type === 'rain') return '#3b82f6';
  if (type === 'snow') return '#ffffff';
  if (type === 'fog') return '#9ca3af';
  return null;
};

const GridRadarLayer = ({ scannedGrid, currentZoom = 6 }) => {
  // Generamos tanto los features de GeoJSON (para las manchas invisibles de momento)
  // como los datos para los Marcadores CSS
  const { geojson, activeMarkers } = useMemo(() => {
    const features = [];
    const markers = [];
    
    if (scannedGrid && scannedGrid.length > 0) {
      scannedGrid.forEach((cell, index) => {
        const type = getWeatherType(cell.weather_code);
        if (type && cell.latitud && cell.longitud) {
          const color = getWeatherColor(type);
          
          features.push({
            type: 'Feature',
            properties: { color },
            geometry: {
              type: 'Point',
              coordinates: [cell.longitud, cell.latitud]
            }
          });
          
          markers.push({
            id: `weather-marker-${index}`,
            longitude: cell.longitud,
            latitude: cell.latitud,
            type: type
          });
        }
      });
    }
    
    return {
      geojson: { type: 'FeatureCollection', features },
      activeMarkers: markers
    };
  }, [scannedGrid]);

  const organicLayer = {
    id: 'radar-organic-layer',
    type: 'circle',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 15,
        6, 50,
        9, 200,
        12, 600
      ],
      'circle-blur': 2.0,
      // EL USUARIO PIDIÓ: "Haz invisible las manchas azules para que se vea solo la animación"
      'circle-opacity': 0.0 
    }
  };

  // Cálculo de tamaño dinámico con límites (clamping)
  // Base 100px en zoom 6. Multiplicador matemático para que el área encaje en el mapa físico.
  const rawSize = 100 * Math.pow(2, currentZoom - 6);
  // Mínimo 45px (para que no desaparezcan las gotas al hacer mucho zoom out)
  // Máximo 250px (para que no cubra medio país al hacer mucho zoom in)
  const clampedSize = Math.max(45, Math.min(250, rawSize));

  return (
    <>
      <style>{`.css-weather-marker { width: ${clampedSize}px !important; height: ${clampedSize}px !important; }`}</style>

      <Source id="radar-organic-source" type="geojson" data={geojson}>
        <Layer {...organicLayer} />
      </Source>

      {/* Renderizamos las animaciones puras en CSS sobre los puntos activos */}
      {activeMarkers.map(m => (
        <Marker 
          key={m.id} 
          longitude={m.longitude} 
          latitude={m.latitude} 
          anchor="center"
          // Se quitó pitchAlignment para que caigan verticalmente de frente al usuario
        >
          <div className={`css-weather-marker ${m.type}`}></div>
        </Marker>
      ))}
    </>
  );
};

export default GridRadarLayer;
