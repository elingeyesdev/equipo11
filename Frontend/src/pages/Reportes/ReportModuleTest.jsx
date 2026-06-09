// Frontend/src/pages/Reportes/ReportModuleTest.jsx
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import Map, { Marker, Source, Layer, useControl } from 'react-map-gl/mapbox';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { exportarAExcel, exportarAExcelMasivo, exportarAPDF } from '../../services/exportService';
import useFronteras from '../../hooks/useFronteras';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// Componente para integrar MapboxDraw en react-map-gl
function DrawControl(props) {
  useControl(
    () => new MapboxDraw(props),
    ({ map }) => {
      map.on('draw.create', props.onCreate);
      map.on('draw.update', props.onUpdate);
      map.on('draw.delete', props.onDelete);
    },
    ({ map }) => {
      map.off('draw.create', props.onCreate);
      map.off('draw.update', props.onUpdate);
      map.off('draw.delete', props.onDelete);
    },
    { position: props.position || 'top-left' }
  );
  return null;
}

const AVAILABLE_LAYERS = [
  'temperatura', 'lluvia', 'evaporacion', 'viento', 'visibilidad', 'humedad', 'uv', 'nieve'
];

const geojsonStyle = {
  id: 'selected-region',
  type: 'fill',
  paint: {
    'fill-color': 'rgba(94, 234, 212, 0.2)',
    'fill-outline-color': '#5eead4'
  }
};

const ReportModuleTest = () => {
  const navigate = useNavigate();
  
  // Coordenadas y Previsualización
  const [lat, setLat] = useState(-16.5000);
  const [lon, setLon] = useState(-68.1193); // Default La Paz
  const [regionName, setRegionName] = useState('');
  
  // Modos y Capas Geográficas
  const [selectionType, setSelectionType] = useState('point'); // point, polygon, country, department, province
  const [selectedGeoJson, setSelectedGeoJson] = useState(null);
  const [subRegionsForExport, setSubRegionsForExport] = useState([]); // [{ name, lat, lon }]
  
  // Formulario y Estados de Datos
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [intervalHours, setIntervalHours] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  
  const chartRef = useRef(null);
  const mapRef = useRef(null);
  const workerRef = useRef(null);

  // useFronteras
  const { paises, fetchProvincias, fetchGeoBoundary } = useFronteras();
  const [pais, setPais] = useState('');
  const [depto, setDepto] = useState('');
  const [prov, setProv] = useState('');
  const [departamentos, setDepartamentos] = useState([]);
  const [provincias, setProvincias] = useState([]);

  // Estilos Premium Estrictos
  const bgColor = '#0f172a'; // Negro/Azul profundo
  const cardColor = '#18181b'; // Gris muy oscuro
  const textColor = '#f1f5f9';
  const borderColor = '#27272a';
  const accentColor = '#86efac'; // Cyan oscuro / Verde pálido
  const btnPdfColor = '#ef4444';
  const btnExcelColor = '#22c55e';

  // Reactividad del Worker (Previsualización de 1 punto)
  useEffect(() => {
    if (lat === null || lon === null || !startDate || !endDate || selectedLayers.length === 0) {
      return;
    }

    if (workerRef.current) {
      workerRef.current.terminate();
    }

    setLoading(true);

    const worker = new Worker(new URL('../../workers/weatherWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const fullStart = `${startDate}T00:00:00`;
    const fullEnd = `${endDate}T23:59:59`;

    // Para la vista en vivo, extraemos solo 1 punto (el centroide o punto clickeado)
    worker.postMessage({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      regionName,
      isMassiveExport: false,
      startDate: fullStart,
      endDate: fullEnd,
      intervalHours: parseInt(intervalHours, 10),
      selectedLayers
    });

    worker.onmessage = (e) => {
      const { status, data: resultData, error } = e.data;
      if (status === 'success') {
        setData(resultData);
      } else {
        console.error("Worker error:", error);
      }
      setLoading(false);
      workerRef.current = null;
    };

    worker.onerror = (error) => {
      console.error("Worker generic error:", error);
      setLoading(false);
      workerRef.current = null;
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [lat, lon, startDate, endDate, selectedLayers, intervalHours]);

  // Manejo de Dibujo Libre (MapboxDraw)
  const onDrawCreate = (e) => {
    const polygon = e.features[0];
    const centroid = turf.centroid(polygon);
    
    setLat(centroid.geometry.coordinates[1]);
    setLon(centroid.geometry.coordinates[0]);
    setRegionName('Polígono Dibujado');
    setSelectionType('polygon');
    
    setSelectedGeoJson({ type: "FeatureCollection", features: [polygon] });
    setSubRegionsForExport([{ 
      name: 'Polígono Dibujado (Centroide)', 
      lat: centroid.geometry.coordinates[1], 
      lon: centroid.geometry.coordinates[0] 
    }]);

    // Limpiar selects
    setPais(''); setDepto(''); setProv('');
  };

  const onDrawUpdate = (e) => onDrawCreate(e);
  const onDrawDelete = () => {
    setSelectedGeoJson(null);
    setSelectionType('point');
    setSubRegionsForExport([]);
  };

  const handleMapClick = (e) => {
    // Solo si no hay geometrías activas (evita solapamientos con el dibujo)
    if (selectionType === 'polygon') return;
    
    setLat(e.lngLat.lat);
    setLon(e.lngLat.lng);
    setRegionName('');
    setSelectionType('point');
    setSelectedGeoJson(null);
    setSubRegionsForExport([{ name: 'Punto Manual', lat: e.lngLat.lat, lon: e.lngLat.lng }]);
    setPais(''); setDepto(''); setProv('');
  };

  // Procesamiento de GeoBoundary desde useFronteras
  const processGeoBoundary = (geo, name, type) => {
    if (geo && geo.geojson) {
      setSelectedGeoJson(geo.geojson);
      setSelectionType(type);
      setRegionName(name);
      
      // Mapear features del GeoJSON y calcular centroides con Turf para exportación masiva
      const extractedSubRegions = [];
      let mainCentroidLat = lat;
      let mainCentroidLon = lon;

      if (geo.geojson.features && geo.geojson.features.length > 0) {
        geo.geojson.features.forEach((feature, idx) => {
          const centroid = turf.centroid(feature);
          const cLon = centroid.geometry.coordinates[0];
          const cLat = centroid.geometry.coordinates[1];
          const fName = feature.properties?.name || `${name} - Sector ${idx + 1}`;
          
          extractedSubRegions.push({ name: fName, lat: cLat, lon: cLon });
          
          if (idx === 0) {
            mainCentroidLat = cLat;
            mainCentroidLon = cLon;
          }
        });
      }

      setSubRegionsForExport(extractedSubRegions);
      setLat(mainCentroidLat);
      setLon(mainCentroidLon);

      if (geo.bbox && mapRef.current) {
        mapRef.current.fitBounds(
          [[geo.bbox[0][0], geo.bbox[0][1]], [geo.bbox[1][0], geo.bbox[1][1]]],
          { padding: 40, duration: 1000 }
        );
      }
    }
  };

  const handlePaisChange = async (e) => {
    const p = e.target.value;
    setPais(p); setDepto(''); setProv('');
    setDepartamentos([]); setProvincias([]);
    if (p) {
      const pObj = paises.find(x => x.name === p);
      if (pObj && pObj.states) setDepartamentos(pObj.states.sort((a, b) => a.name.localeCompare(b.name)));
      const geo = await fetchGeoBoundary(p, '', '');
      if (geo) processGeoBoundary(geo, p, 'country');
    } else {
      setSelectedGeoJson(null); setSelectionType('point');
    }
  };

  const handleDeptoChange = async (e) => {
    const d = e.target.value;
    setDepto(d); setProv(''); setProvincias([]);
    if (d) {
      const provs = await fetchProvincias(pais, d);
      setProvincias(provs);
      const geo = await fetchGeoBoundary(pais, d, '');
      if (geo) processGeoBoundary(geo, `${d}, ${pais}`, 'department');
    } else {
      const geo = await fetchGeoBoundary(pais, '', '');
      if (geo) processGeoBoundary(geo, pais, 'country');
    }
  };

  const handleProvChange = async (e) => {
    const pr = e.target.value;
    setProv(pr);
    if (pr) {
      const geo = await fetchGeoBoundary(pais, depto, pr);
      if (geo) processGeoBoundary(geo, `${pr}, ${depto}, ${pais}`, 'province');
    } else {
      const geo = await fetchGeoBoundary(pais, depto, '');
      if (geo) processGeoBoundary(geo, `${depto}, ${pais}`, 'department');
    }
  };

  const handleLayerChange = (layer) => {
    if (selectedLayers.includes(layer)) {
      setSelectedLayers(selectedLayers.filter(l => l !== layer));
    } else {
      if (selectedLayers.length >= 3) {
        alert("Máximo 3 variables permitidas");
        return;
      }
      setSelectedLayers([...selectedLayers, layer]);
    }
  };

  const handleExportPDF = () => {
    if (data.length === 0) return;
    let base64Graph = null;
    if (chartRef.current) {
      base64Graph = chartRef.current.getEchartsInstance().getDataURL({
        type: 'png', pixelRatio: 2, backgroundColor: cardColor
      });
    }
    exportarAPDF(data, selectedLayers, base64Graph);
  };

  const handleExportExcel = () => {
    if (data.length === 0) return;
    
    // Lógica Masiva
    const isMassive = ['polygon', 'country', 'department'].includes(selectionType);
    
    if (isMassive && subRegionsForExport.length > 0) {
      setLoading(true);
      // Spawn worker for massive extraction
      const mWorker = new Worker(new URL('../../workers/weatherWorker.js', import.meta.url), { type: 'module' });
      
      const fullStart = `${startDate}T00:00:00`;
      const fullEnd = `${endDate}T23:59:59`;

      mWorker.postMessage({
        isMassiveExport: true,
        locations: subRegionsForExport,
        startDate: fullStart,
        endDate: fullEnd,
        intervalHours: parseInt(intervalHours, 10),
        selectedLayers
      });

      mWorker.onmessage = (e) => {
        const { status, data: massiveData, error } = e.data;
        if (status === 'success') {
          exportarAExcelMasivo(massiveData, selectedLayers, regionName);
        } else {
          alert("Error en extracción masiva: " + error);
        }
        setLoading(false);
        mWorker.terminate();
      };
      
    } else {
      exportarAExcel(data, selectedLayers);
    }
  };

  const chartOptions = useMemo(() => {
    if (data.length === 0 || selectedLayers.length === 0) return {};

    const dates = data.map(item => new Date(item.date).toLocaleString());
    const grid = []; const xAxis = []; const yAxis = []; const series = [];
    const heightPerChart = 100 / selectedLayers.length;

    selectedLayers.forEach((layer, index) => {
      const top = `${index * heightPerChart + 5}%`;
      const height = `${heightPerChart - 15}%`;

      grid.push({ top, height, left: '5%', right: '5%' });
      xAxis.push({
        type: 'category', data: dates, gridIndex: index,
        show: index === selectedLayers.length - 1,
        axisLabel: { show: index === selectedLayers.length - 1, color: textColor }
      });
      yAxis.push({
        type: 'value', gridIndex: index,
        name: layer.charAt(0).toUpperCase() + layer.slice(1),
        nameTextStyle: { color: textColor },
        axisLabel: { color: textColor },
        splitLine: { show: true, lineStyle: { color: borderColor } }
      });
      series.push({
        name: layer.charAt(0).toUpperCase() + layer.slice(1),
        type: 'line', xAxisIndex: index, yAxisIndex: index,
        data: data.map(item => item[layer]),
        showSymbol: false, lineStyle: { width: 2, color: accentColor },
        itemStyle: { color: accentColor }
      });
    });

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      axisPointer: { link: { xAxisIndex: 'all' } },
      grid, xAxis, yAxis, series
    };
  }, [data, selectedLayers]);

  const nowString = new Date().toISOString().split('T')[0];
  const minDate = "2024-01-01";
  
  // Desactivación Estratégica de PDF
  const disablePDF = ['polygon', 'country', 'department'].includes(selectionType);

  return (
    <div style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Poppins, sans-serif', color: textColor, background: 'transparent', minHeight: '100vh', transition: 'all 0.3s' }}>
      <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '30px', borderBottom: `1px solid ${borderColor}`, paddingBottom: '10px' }}>
        Reportes <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: accentColor, fontWeight: 400 }}>Ambientales</span>
      </h2>
      
      {/* PANEL SUPERIOR: CONTROLES EN FILA */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px', background: cardColor, padding: '20px', borderRadius: '12px', border: `1px solid ${borderColor}` }}>
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#94a3b8', fontWeight: 600 }}>Fecha Inicio</label>
          <input type="date" value={startDate} min={minDate} max={nowString} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: bgColor, color: textColor }} />
        </div>
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#94a3b8', fontWeight: 600 }}>Fecha Fin</label>
          <input type="date" value={endDate} min={minDate} max={nowString} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: bgColor, color: textColor }} />
        </div>
        <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#94a3b8', fontWeight: 600 }}>Frecuencia</label>
          <select value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: bgColor, color: textColor }}>
            <option value={1}>1 Hora</option><option value={6}>6 Horas</option><option value={12}>12 Horas</option><option value={24}>24 Horas</option>
          </select>
        </div>
        <div style={{ flex: '3 1 300px', display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#94a3b8', fontWeight: 600 }}>Buscador Espacial (País / Depto / Prov)</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={pais} onChange={handlePaisChange} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: bgColor, color: textColor }}>
              <option value="">País...</option>
              {paises.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <select value={depto} onChange={handleDeptoChange} disabled={!pais} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: bgColor, color: textColor }}>
              <option value="">Depto...</option>
              {departamentos.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            <select value={prov} onChange={handleProvChange} disabled={!depto} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: bgColor, color: textColor }}>
              <option value="">Provincia...</option>
              {provincias.map(pr => <option key={pr} value={pr}>{pr}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px', background: cardColor, padding: '20px', borderRadius: '12px', border: `1px solid ${borderColor}`, alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', margin: '0 20px 0 0', fontWeight: 600 }}>Variables (Máx. 3):</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', flex: 1 }}>
          {AVAILABLE_LAYERS.map(layer => (
            <label key={layer} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: bgColor, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${borderColor}` }}>
              <input type="checkbox" checked={selectedLayers.includes(layer)} onChange={() => handleLayerChange(layer)} disabled={selectedLayers.length >= 3 && !selectedLayers.includes(layer)} style={{ accentColor: accentColor, width: '16px', height: '16px' }} />
              <span style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>{layer}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportPDF} disabled={data.length === 0 || loading || disablePDF} style={{ padding: '10px 20px', background: btnPdfColor, color: 'white', border: 'none', borderRadius: '8px', cursor: data.length === 0 || loading || disablePDF ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', opacity: data.length === 0 || loading || disablePDF ? 0.5 : 1 }}>
            📄 Exportar PDF {disablePDF && '(Deshabilitado en modo masivo)'}
          </button>
          <button onClick={handleExportExcel} disabled={data.length === 0 || loading} style={{ padding: '10px 20px', background: btnExcelColor, color: 'white', border: 'none', borderRadius: '8px', cursor: data.length === 0 || loading ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', opacity: data.length === 0 || loading ? 0.5 : 1 }}>
            📊 Exportar Excel {['polygon', 'country', 'department'].includes(selectionType) && '(Masivo)'}
          </button>
        </div>
      </div>

      {/* PANEL INFERIOR: SPLIT SCREEN (GRAFICOS / MAPA) */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', height: '700px' }}>
        
        {/* ECharts View */}
        <div style={{ flex: '2 1 600px', position: 'relative', border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '20px', background: cardColor, height: '100%' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: accentColor }}>
            Visualización: {regionName || (selectionType === 'point' ? `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}` : 'Cargando...')}
          </h3>
          
          {loading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(24, 24, 27, 0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: `4px solid ${borderColor}`, borderTopColor: accentColor, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px auto' }}></div>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: accentColor }}>Extrayendo Datos Ambientales...</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          )}

          {data.length > 0 ? (
            <ReactECharts ref={chartRef} option={chartOptions} theme="dark" style={{ height: 'calc(100% - 40px)', width: '100%' }} notMerge={true} />
          ) : !loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <p>Configure los parámetros y dibuje/seleccione una zona para visualizar la serie de tiempo.</p>
            </div>
          ) : null}
        </div>

        {/* Mapbox Mini-Map */}
        <div style={{ flex: '1 1 400px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${borderColor}`, height: '100%', position: 'relative' }}>
          <Map
            ref={mapRef}
            initialViewState={{ longitude: lon, latitude: lat, zoom: 4 }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
            onClick={handleMapClick}
            interactive={true}
          >
            {/* Control de Dibujo */}
            <DrawControl
              position="top-right"
              displayControlsDefault={false}
              controls={{ polygon: true, trash: true }}
              onCreate={onDrawCreate}
              onUpdate={onDrawUpdate}
              onDelete={onDrawDelete}
            />

            {/* Capa de Frontera Seleccionada */}
            {selectedGeoJson && (
              <Source id="selected-source" type="geojson" data={selectedGeoJson}>
                <Layer {...geojsonStyle} />
              </Source>
            )}

            {/* Marcador del Centroide de Previsualización */}
            <Marker longitude={lon} latitude={lat} color={accentColor} />
          </Map>
        </div>

      </div>

      {/* Botón de Regreso */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
        <button 
          onClick={() => navigate('/mapa-historico')} 
          style={{ padding: '12px 24px', background: cardColor, color: textColor, border: `1px solid ${borderColor}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px' }}
          onMouseOver={(e) => e.target.style.background = '#27272a'}
          onMouseOut={(e) => e.target.style.background = cardColor}
        >
          ← Volver al Mapa Histórico
        </button>
      </div>
    </div>
  );
};

export default ReportModuleTest;
