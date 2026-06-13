import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as turf from '@turf/turf';
import Map, { NavigationControl, FullscreenControl, Popup, Layer, Source } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import { useSimulacion } from '../../context/SimulacionContext';
import { useZonaSim } from '../../context/ZonaSimContext';
import { useMapVisuals } from '../../context/MapVisualsContext';
import { useUmbrales } from '../../hooks/useUmbrales';
import FronterasPanel from '../../components/FronterasPanel/FronterasPanel';
import ModalSimulacion from '../../components/ModalSimulacion/ModalSimulacion';
import ModalInyeccion from '../../components/ModalInyeccion/ModalInyeccion';
import MarkersLayer from './layers/MarkersLayer';
import VoronoiLayer from './layers/VoronoiLayer';
import useSensors from '../../hooks/useSensors';
import { useUnidades } from '../../hooks/useUnidades';
import { Marker } from 'react-map-gl/mapbox';
import CityHistoryPanel from '../../components/MapaMonitoreo/CityHistoryPanel';
import ControlPanel from '../../components/MapaMonitoreo/ControlPanel';
import SimulationStatus from '../../components/MapaMonitoreo/SimulationStatus';
import { METRICAS_UNIDADES, formatearValor } from '../../utils/unidades';

import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '../../context/ThemeContext';
import './MapaMonitoreo.css';
import HistoricalWindParticles from '../../components/MapaMonitoreo/HistoricalWindParticles';
import useFronteras from '../../hooks/useFronteras';

// =======================================================
// BUSCADOR ESPACIAL INTERNO (Reemplazo de Geocoder)
// =======================================================
function BuscadorEspacial({ mapRef }) {
  const { paises, fetchProvincias, fetchGeoBoundary } = useFronteras();
  const [pais, setPais] = useState('');
  const [depto, setDepto] = useState('');
  const [prov, setProv] = useState('');
  const [departamentos, setDepartamentos] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [loading, setLoading] = useState(false);

  const handlePaisChange = async (e) => {
    const p = e.target.value;
    setPais(p); setDepto(''); setProv(''); setDepartamentos([]); setProvincias([]);
    if (p) {
      const pObj = paises.find(x => x.name === p);
      if (pObj && pObj.states) setDepartamentos(pObj.states.sort((a,b) => a.name.localeCompare(b.name)));
    }
  };

  const handleDeptoChange = async (e) => {
    const d = e.target.value;
    setDepto(d); setProv(''); setProvincias([]);
    if (d) {
      const provs = await fetchProvincias(pais, d);
      setProvincias(provs);
    }
  };

  const handleFly = async () => {
    if (!pais || !mapRef.current) return;
    setLoading(true);
    const result = await fetchGeoBoundary(pais, depto, prov);
    setLoading(false);
    if (result && result.bbox) {
      mapRef.current.fitBounds(result.bbox, { padding: 40, duration: 1500 });
    } else if (result && result.geometry) {
      mapRef.current.flyTo({ center: result.geometry.coordinates, zoom: 6, essential: true, duration: 1500 });
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 20, left: 20, zIndex: 10,
      background: 'var(--card)',
      padding: '10px', borderRadius: 'var(--radius)', color: 'var(--text-primary)',
      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '5px', width: '200px',
      boxShadow: 'var(--shadow-md)'
    }}>
      <select value={pais} onChange={handlePaisChange} style={{ background: 'var(--paper)', color: 'var(--text-primary)', border: '1px solid var(--line)', borderRadius: '4px', padding: '4px', fontFamily: 'var(--font-sans)' }}>
        <option value="">-- País --</option>
        {paises.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>
      {pais && (
        <select value={depto} onChange={handleDeptoChange} style={{ background: 'var(--paper)', color: 'var(--text-primary)', border: '1px solid var(--line)', borderRadius: '4px', padding: '4px', fontFamily: 'var(--font-sans)' }}>
          <option value="">-- Departamento --</option>
          {departamentos.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
      )}
      {depto && (
        <select value={prov} onChange={(e) => setProv(e.target.value)} style={{ background: 'var(--paper)', color: 'var(--text-primary)', border: '1px solid var(--line)', borderRadius: '4px', padding: '4px', fontFamily: 'var(--font-sans)' }}>
          <option value="">-- Provincia --</option>
          {provincias.map(pr => <option key={pr} value={pr}>{pr}</option>)}
        </select>
      )}
      <button onClick={handleFly} disabled={!pais || loading} style={{
        background: 'var(--moss)', color: 'var(--white)', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer', opacity: (!pais || loading) ? 0.5 : 1, fontFamily: 'var(--font-sans)'
      }}>
        {loading ? 'Buscando...' : 'Ir a destino'}
      </button>
    </div>
  );
}

// =======================================================
// SHADERS GLSL — Reproyección Equirectangular → Mercator
// Extraídos de shaders_visibility.js del motor original
// =======================================================
const VERTEX_SHADER = `
  precision highp float;
  attribute vec2 a_pos;
  uniform mat4 u_matrix;
  varying vec2 v_mercator;
  void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
    v_mercator = a_pos;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_data;
  uniform sampler2D u_color_ramp;
  uniform float u_opacity;
  uniform float u_is_wind;
  uniform float u_lon_offset;
  varying vec2 v_mercator;
  const float PI = 3.14159265359;

  void main() {
    float wrappedX = fract(v_mercator.x);
    float lon = wrappedX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    float u = fract(((lon + 180.0) / 360.0) + u_lon_offset);
    float v = (lat + 90.0) / 180.0;

    if (v < 0.0 || v > 1.0) { discard; }

    vec4 texel = texture2D(u_data, vec2(u, v));
    float val = texel.r;

    if (u_is_wind > 0.5) {
      float u_norm = texel.r;
      float v_norm = texel.g;
      float u_ms = (u_norm * 200.0) - 100.0;
      float v_ms = (v_norm * 200.0) - 100.0;
      float speed_ms = sqrt(u_ms * u_ms + v_ms * v_ms);
      float speed_kmh = speed_ms * 3.6;
      val = clamp(speed_kmh / 140.0, 0.0, 1.0);
    }

    vec4 color = texture2D(u_color_ramp, vec2(val, 0.5));
    if (color.a < 0.01) { discard; }
    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;

// =======================================================
// PALETAS DE COLOR (256x1 RGBA textures)
// =======================================================
const COLOR_RAMPS = {
  visibilidad: [
    { t: 0.00, r: 150, g: 45, b: 0, a: 216 },
    { t: 0.04, r: 230, g: 90, b: 0, a: 216 },
    { t: 0.12, r: 255, g: 150, b: 50, a: 204 },
    { t: 0.41, r: 255, g: 220, b: 180, a: 153 },
    { t: 0.90, r: 255, g: 255, b: 255, a: 0 },
    { t: 1.00, r: 0, g: 0, b: 0, a: 0 },
  ],
  rayos: [
    { t: 0.00, r: 0, g: 0, b: 0, a: 0 },
    { t: 0.20, r: 0, g: 0, b: 0, a: 0 },
    { t: 0.30, r: 255, g: 255, b: 0, a: 204 },
    { t: 0.60, r: 255, g: 128, b: 0, a: 230 },
    { t: 1.00, r: 255, g: 0, b: 255, a: 255 },
  ],
  humedad: [
    { t: 0.00, r: 133, g: 68, b: 0, a: 204 },
    { t: 0.20, r: 196, g: 146, b: 63, a: 204 },
    { t: 0.40, r: 255, g: 255, b: 255, a: 204 },
    { t: 0.60, r: 65, g: 157, b: 148, a: 204 },
    { t: 0.80, r: 13, g: 100, b: 93, a: 204 },
    { t: 1.00, r: 3, g: 59, b: 54, a: 230 },
  ],
  uv: [
    { t: 0.00, r: 149, g: 231, b: 68, a: 0 },
    { t: 0.06, r: 149, g: 231, b: 68, a: 204 },
    { t: 0.20, r: 208, g: 209, b: 2, a: 204 },
    { t: 0.40, r: 243, g: 107, b: 0, a: 204 },
    { t: 0.53, r: 220, g: 0, b: 0, a: 204 },
    { t: 0.73, r: 245, g: 0, b: 140, a: 204 },
    { t: 1.00, r: 0, g: 214, b: 255, a: 230 },
  ],
  aqi: [
    { t: 0.00, r: 255, g: 255, b: 255, a: 102 }, // 0: Blanco translúcido
    { t: 0.10, r: 0, g: 255, b: 0, a: 153 },     // 50: Verde
    { t: 0.20, r: 255, g: 255, b: 0, a: 204 },   // 100: Amarillo
    { t: 0.30, r: 255, g: 128, b: 0, a: 204 },   // 150: Naranja
    { t: 0.40, r: 255, g: 0, b: 0, a: 230 },     // 200: Rojo
    { t: 0.60, r: 128, g: 0, b: 128, a: 230 },   // 300+: Púrpura
    { t: 1.00, r: 128, g: 0, b: 128, a: 230 },
  ],
  temperatura: [
    { t: 0.000, r: 230, g: 230, b: 250, a: 230 }, // -60°C
    { t: 0.083, r: 230, g: 230, b: 250, a: 230 }, // -50°C
    { t: 0.250, r: 153, g: 153, b: 255, a: 230 }, // -30°C
    { t: 0.417, r: 74, g: 0, b: 128, a: 230 },    // -10°C
    { t: 0.500, r: 0, g: 255, b: 0, a: 230 },     // 0°C
    { t: 0.625, r: 255, g: 255, b: 0, a: 230 },   // 15°C
    { t: 0.708, r: 255, g: 136, b: 0, a: 230 },   // 25°C
    { t: 0.792, r: 255, g: 0, b: 0, a: 230 },     // 35°C
    { t: 0.875, r: 128, g: 0, b: 0, a: 230 },     // 45°C
    { t: 1.000, r: 128, g: 0, b: 0, a: 230 },     // 60°C
  ],
  lluvia: [
    { t: 0.000, r: 0, g: 255, b: 255, a: 0 },
    { t: 0.020, r: 0, g: 255, b: 255, a: 0 }, // 0.4 mm/h (ruido) = invisible
    { t: 0.050, r: 0, g: 255, b: 255, a: 210 },
    { t: 0.100, r: 0, g: 100, b: 255, a: 210 },
    { t: 0.250, r: 0, g: 0, b: 255, a: 210 },
    { t: 0.500, r: 100, g: 0, b: 200, a: 210 },
    { t: 0.750, r: 180, g: 0, b: 180, a: 210 },
    { t: 1.000, r: 255, g: 0, b: 255, a: 210 },
  ],
  nieve: [
    { t: 0.000, r: 255, g: 255, b: 255, a: 0 },
    { t: 0.001, r: 255, g: 255, b: 255, a: 210 },
    { t: 0.033, r: 221, g: 251, b: 255, a: 210 },
    { t: 0.100, r: 174, g: 239, b: 255, a: 210 },
    { t: 0.200, r: 114, g: 227, b: 255, a: 210 },
    { t: 0.333, r: 63, g: 212, b: 245, a: 210 },
    { t: 0.500, r: 28, g: 184, b: 231, a: 210 },
    { t: 0.666, r: 23, g: 147, b: 209, a: 210 },
    { t: 0.800, r: 19, g: 108, b: 181, a: 210 },
    { t: 0.900, r: 43, g: 78, b: 162, a: 210 },
    { t: 1.000, r: 64, g: 12, b: 112, a: 210 },
  ],
  isobaras: [ // Dummy para evitar fallos, la lógica matemática va en buildRampPixels
    { t: 0.00, r: 255, g: 255, b: 255, a: 200 },
    { t: 1.00, r: 255, g: 255, b: 255, a: 200 },
  ],
  viento: [
    { t: 0.000, r: 51,  g: 51,  b: 255, a: 210 },
    { t: 0.071, r: 70,  g: 130, b: 180, a: 210 },
    { t: 0.142, r: 46,  g: 139, b: 87,  a: 210 },
    { t: 0.214, r: 0,   g: 255, b: 0,   a: 210 },
    { t: 0.285, r: 173, g: 255, b: 47,  a: 210 },
    { t: 0.357, r: 255, g: 255, b: 0,   a: 210 },
    { t: 0.428, r: 255, g: 204, b: 0,   a: 210 },
    { t: 0.500, r: 255, g: 136, b: 0,   a: 210 },
    { t: 0.571, r: 255, g: 69,  b: 0,   a: 210 },
    { t: 0.714, r: 139, g: 0,   b: 0,   a: 210 },
    { t: 0.857, r: 255, g: 0,   b: 255, a: 210 },
    { t: 1.000, r: 255, g: 182, b: 193, a: 210 },
  ],
  evaporacion: [
    { t: 0.000, r: 0,   g: 0,   b: 0,   a: 0   },   // 0 W/m² = transparente
    { t: 0.020, r: 0,   g: 0,   b: 0,   a: 0   },   // ruido = invisible
    { t: 0.050, r: 200, g: 220, b: 255, a: 120 },   // azul muy claro
    { t: 0.150, r: 160, g: 200, b: 240, a: 160 },   // azul cielo
    { t: 0.300, r: 130, g: 170, b: 220, a: 190 },   // azul medio
    { t: 0.500, r: 180, g: 190, b: 200, a: 200 },   // gris azulado
    { t: 0.700, r: 210, g: 210, b: 215, a: 210 },   // gris claro
    { t: 0.850, r: 235, g: 235, b: 240, a: 220 },   // casi blanco
    { t: 1.000, r: 255, g: 255, b: 255, a: 230 },   // blanco puro (500 W/m²)
  ],
};

function buildRampPixels(stops, activeLayer) {
  const pixels = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    // Lógica para Isobaras dentro de la generación del Uint8Array
    if (activeLayer === 'isobaras') {
      pixels[i * 4] = 255;     // R: Blanco constante
      pixels[i * 4 + 1] = 255; // G: Blanco constante
      pixels[i * 4 + 2] = 255; // B: Blanco constante
      
      // Suavizado de bordes (Anti-aliasing manual)
      if (i % 12 === 0) { 
        pixels[i * 4 + 3] = 220; // Centro de la línea (muy visible)
      } else if (i % 12 === 1 || i % 12 === 11) {
        pixels[i * 4 + 3] = 100; // Borde interior (semitransparente)
      } else if (i % 12 === 2 || i % 12 === 10) {
        pixels[i * 4 + 3] = 40;  // Borde exterior (casi transparente)
      } else {
        pixels[i * 4 + 3] = 0;   // Resto invisible
      }
      continue;
    }

    const t = i / 255;
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j].t && t <= stops[j + 1].t) { lo = stops[j]; hi = stops[j + 1]; break; }
    }
    const range = hi.t - lo.t;
    const f = range > 0 ? Math.min(1, Math.max(0, (t - lo.t) / range)) : 0;
    pixels[i * 4 + 0] = Math.round(lo.r + f * (hi.r - lo.r));
    pixels[i * 4 + 1] = Math.round(lo.g + f * (hi.g - lo.g));
    pixels[i * 4 + 2] = Math.round(lo.b + f * (hi.b - lo.b));
    pixels[i * 4 + 3] = Math.round(lo.a + f * (hi.a - lo.a));
  }
  return pixels;
}

// =======================================================
// TIMELINE COMPONENT
// =======================================================
function TimelineSlider({ date, setDate, setIsPlaying, timelineTicks, minDate, maxDate, idPrefix, onDragStateChange }) {
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const isDraggingRef = useRef(false);

  // ─── Ruleta Auto-Centrado ───
  useEffect(() => {
    if (isDraggingRef.current) return;
    const activeTickId = `${idPrefix}-tick-${date.getTime()}`;
    const element = document.getElementById(activeTickId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [date, timelineTicks, idPrefix]);

  const snapToNearestTick = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    const children = container.querySelectorAll('[id^="tick-"]');
    let closestChild = null;
    let closestDistance = Infinity;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(childCenter - containerCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestChild = child;
      }
    }

    if (closestChild && closestChild.id && closestChild.id.startsWith(`${idPrefix}-tick-`)) {
      const timestamp = parseInt(closestChild.id.replace(`${idPrefix}-tick-`, ''));
      if (!isNaN(timestamp)) {
        const snappedDate = new Date(timestamp);
        const minTime = new Date(minDate + 'T00:00:00Z').getTime();
        const maxTime = new Date(maxDate + 'T23:00:00Z').getTime();
        if (timestamp >= minTime && timestamp <= maxTime) {
          setDate(snappedDate);
        }
      }
    }
  }, [setDate, minDate, maxDate]);

  const handleMouseDown = (e) => {
    setIsPlaying(false);
    setIsDragging(true);
    isDraggingRef.current = true;
    if (onDragStateChange) onDragStateChange(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      setIsDragging(false);
      isDraggingRef.current = false;
      if (onDragStateChange) onDragStateChange(false);
      snapToNearestTick();
    }
  };
  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      setIsDragging(false);
      isDraggingRef.current = false;
      if (onDragStateChange) onDragStateChange(false);
      snapToNearestTick();
    }
  };
  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  return (
    <div 
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      style={{ 
        flex: 1, display: 'flex', overflowX: 'auto', 
        gap: '6px', padding: '15px 0 5px 0',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        scrollbarWidth: 'none', msOverflowStyle: 'none'
      }} 
    >
      {(() => {
        const groups = {};
        timelineTicks.forEach(tickDate => {
          const dayKey = `${tickDate.getUTCFullYear()}-${String(tickDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tickDate.getUTCDate()).padStart(2, '0')}`;
          if (!groups[dayKey]) groups[dayKey] = [];
          groups[dayKey].push(tickDate);
        });

        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        return Object.entries(groups).map(([dayKey, ticks]) => {
          const sample = ticks[0];
          const dayNum = String(sample.getUTCDate()).padStart(2, '0');
          const monthNum = String(sample.getUTCMonth() + 1).padStart(2, '0');
          const weekday = dayNames[sample.getUTCDay()];

          return (
            <div key={dayKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <span style={{
                alignSelf: 'flex-start', marginLeft: '4px',
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px',
                color: 'var(--text-secondary)', whiteSpace: 'nowrap', pointerEvents: 'none'
              }}>
                {weekday} {dayNum}/{monthNum}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {ticks.map((tickDate) => {
                  const isSelected = tickDate.getTime() === date.getTime();
                  const hr = String(tickDate.getUTCHours()).padStart(2, '0');
                  return (
                    <div
                      key={tickDate.getTime()}
                      id={`${idPrefix}-tick-${tickDate.getTime()}`}
                      onClick={() => setDate(tickDate)}
                      style={{
                        minWidth: '38px', padding: '5px 3px', borderRadius: 'var(--radius)',
                        background: isSelected ? 'var(--moss)' : 'var(--paper-2)',
                        border: isSelected ? '1px solid var(--moss)' : '1px solid transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{
                        fontSize: '12px', fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'var(--white)' : 'var(--text-secondary)',
                        pointerEvents: 'none'
                      }}>
                        {hr}:00
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}

// =======================================================
// COMPONENTE PRINCIPAL
// =======================================================
const MIN_DATE = '2024-01-01';
const MAX_DATE = new Date().toISOString().split('T')[0];
const BASE_DATA_URL = (import.meta.env.VITE_MAP_DATA_URL || 'http://localhost:8080').replace(/\/+$/, '');

const createHistoricalLayer = (id, activeLayerRefInner) => ({
  id: id,
  type: 'custom',
  renderingMode: '2d',
  _gl: null,
  _program: null,
  _buffer: null,
  _dataTex: null,
  _rampTex: null,
  _pendingImg: null,

  onAdd(_map, gl) {
    this._gl = gl;

    // Compilar shaders
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[HistoricoLayer] Shader error:', gl.getShaderInfoLog(s));
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    this._program = gl.createProgram();
    gl.attachShader(this._program, vs);
    gl.attachShader(this._program, fs);
    gl.linkProgram(this._program);

    this._aPos = gl.getAttribLocation(this._program, 'a_pos');
    this._uMatrix = gl.getUniformLocation(this._program, 'u_matrix');
    this._uData = gl.getUniformLocation(this._program, 'u_data');
    this._uRamp = gl.getUniformLocation(this._program, 'u_color_ramp');
    this._uOpacity = gl.getUniformLocation(this._program, 'u_opacity');
    this._uIsWind = gl.getUniformLocation(this._program, 'u_is_wind');
    this._uLonOffset = gl.getUniformLocation(this._program, 'u_lon_offset');

    // Quad que cubre el mundo en coordenadas Mercator (scroll infinito)
    const yTop = mapboxgl.MercatorCoordinate.fromLngLat([0, 85.051]).y;
    const yBot = mapboxgl.MercatorCoordinate.fromLngLat([0, -85.051]).y;
    const verts = new Float32Array([
      -5, yTop, 6, yTop, -5, yBot,
      6, yTop, 6, yBot, -5, yBot,
    ]);
    this._buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    // Textura de datos (vacía inicial)
    this._dataTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._dataTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));

    // Textura de color ramp
    this._rampTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._rampTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const initStops = COLOR_RAMPS[activeLayerRefInner.current] || COLOR_RAMPS.lluvia;
    const initRamp = buildRampPixels(initStops, activeLayerRefInner.current);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, initRamp);

    // Si ya había una imagen esperando, subirla
    if (this._pendingImg) {
      gl.bindTexture(gl.TEXTURE_2D, this._dataTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._pendingImg);
      this._pendingImg = null;
    }
  },

  render(gl, matrix) {
    if (!this._program) return;
    if (activeLayerRefInner.current === 'aqi') return; // Bloquear WebGL para capa vectorial

    gl.useProgram(this._program);
    gl.uniformMatrix4fv(this._uMatrix, false, matrix);
    gl.uniform1f(this._uOpacity, 0.85);
    gl.uniform1f(this._uIsWind, activeLayerRefInner.current === 'viento' ? 1.0 : 0.0);

    const shiftLayers = ['evaporacion'];
    const isShifted = shiftLayers.includes(activeLayerRefInner.current);
    gl.uniform1f(this._uLonOffset, isShifted ? 0.5 : 0.0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._dataTex);
    gl.uniform1i(this._uData, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._rampTex);
    gl.uniform1i(this._uRamp, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(this._aPos);
    gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

    // Habilitar alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
});

function MapaMonitoreo() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  
  // --- MIGRATION CONTEXTS ---
  const { isSimMode, setIsSimMode, fronterasSeleccionadas, setFronterasSeleccionadas, zona1Cfg, zona2Cfg } = useSimulacion();
  const { zonaSimActiva, iniciarZona, detenerZona, zonaSimZonas, zonaSimUnidad, zonaSimEscNombre, zonaSimMetrica, zonaSimProgreso, zonaSimTiempo, zonaSimSesionId, zonaSimTotalLecturas } = useZonaSim();
  const { 
    isParticlesActive, setIsParticlesActive, 
    particleFilters, setParticleFilters, 
    showSensors, setShowSensors, 
    isHeatmapActive, setIsHeatmapActive, 
    heatmapMetric, setHeatmapMetric, 
    isChoroplethActive, setIsChoroplethActive,
    isHistoricalMode, setIsHistoricalMode,
    isDynamicHistoricalMode, setIsDynamicHistoricalMode
  } = useMapVisuals();
  const { umbrales } = useUmbrales(heatmapMetric || 'aqi');
  const { unidades } = useUnidades();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [fronterasParaSimular, setFronterasParaSimular] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);

  const { citiesData: baseCitiesData } = useSensors({ scannedGrid: null, simulatedCities: [], isParticlesActive: true, particleFilters });
  
  const [meteoroOverrides, setMeteoroOverrides] = useState(null);

  const citiesData = useMemo(() => {
    if (!meteoroOverrides) return baseCitiesData;
    return baseCitiesData.map(city => {
      if (meteoroOverrides.datos[city.nombre] !== undefined) {
        return { ...city, [meteoroOverrides.metrica]: meteoroOverrides.datos[city.nombre] };
      }
      return city;
    });
  }, [baseCitiesData, meteoroOverrides]);
  
  
  const handleToggleSimMode = useCallback((active) => {
    setIsSimMode(active);
    if (active) setSelectedCity(null);
  }, [setIsSimMode]);

  const handleStartSimulation = useCallback((fronteras) => {
    setFronterasParaSimular(fronteras);
    setIsModalOpen(true);
  }, []);

  const handleBoundarySelect = useCallback(({ z1, z2 }) => {
    const arr = [];
    if (z1) arr.push(z1);
    if (z2) arr.push(z2);
    setFronterasSeleccionadas(arr);
  }, [setFronterasSeleccionadas]);
  // -------------------------

  const [isComparing, setIsComparing] = useState(false);
  const globalIsDraggingRef = useRef(false);
  const [date1, setDate1] = useState(new Date('2024-01-01T00:00:00Z'));
  const [date2, setDate2] = useState(new Date('2024-01-01T00:00:00Z'));
  const [timelineAnchorDate, setTimelineAnchorDate] = useState(new Date('2024-01-01T00:00:00Z'));
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  
  const [activeLayer, setActiveLayer] = useState('lluvia');
  const activeLayerRef = useRef(activeLayer);
  const [aqiGeoJson, setAqiGeoJson] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [firstSymbolId, setFirstSymbolId] = useState(null);
  const [windPixels, setWindPixels] = useState(null);
  const [windPixels2, setWindPixels2] = useState(null);

  const formatBackendDate = useCallback((date) => {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}00`;
  }, []);

  const currentDate1 = formatBackendDate(date1);
  const currentDate2 = formatBackendDate(date2);

  const canvasCtx1Ref = useRef(null);
  const canvasSize1Ref = useRef({ width: 0, height: 0 });
  const layerMap1Ref = useRef(null);
  const map1InstanceRef = useRef(null);

  const canvasCtx2Ref = useRef(null);
  const canvasSize2Ref = useRef({ width: 0, height: 0 });
  const layerMap2Ref = useRef(null);
  const map2InstanceRef = useRef(null);

  const [timelineAnchorDate1, setTimelineAnchorDate1] = useState(new Date('2024-01-01T00:00:00Z'));
  const [timelineAnchorDate2, setTimelineAnchorDate2] = useState(new Date('2024-01-01T00:00:00Z'));

  // ─── Event Bus para Comandos de IA (Meteoro) ───
  useEffect(() => {
    const handleMeteoroAction = (e) => {
      const acciones = e.detail;
      if (!acciones || !Array.isArray(acciones)) return;

      acciones.forEach(acc => {
        if (acc.comando === 'activar_modo_historico') {
          setIsHistoricalMode(true);
          setIsDynamicHistoricalMode(true);
        }
        if (acc.comando === 'set_fecha' && acc.valor) {
          try {
            const newDate = new Date(acc.valor);
            if (!isNaN(newDate)) {
              setDate1(newDate);
              setTimelineAnchorDate1(newDate);
              setTimelineAnchorDate(newDate); // En caso de que se use un solo timeline
            }
          } catch (err) {
            console.error('Fecha inválida desde IA', acc.valor);
          }
        }
        if (acc.comando === 'reproducir_simulacion') {
          setIsPlaying(true);
        }
        if (acc.comando === 'set_capa' && acc.valor) {
          const capaMapeo = {
            'lluvia': 'lluvia',
            'temperatura': 'temperatura',
            'viento': 'viento',
            'aqi': 'aqi',
            'humedad': 'humedad',
            'ica': 'ica'
          };
          if (capaMapeo[acc.valor]) setActiveLayer(capaMapeo[acc.valor]);
        }
        if (acc.comando === 'activar_comparativo') {
          setIsComparing(true);
          setIsHistoricalMode(true);
        }
        if (acc.comando === 'set_fecha_comparativa' && acc.valor1 && acc.valor2) {
          try {
            const newDate1 = new Date(acc.valor1);
            const newDate2 = new Date(acc.valor2);
            if (!isNaN(newDate1)) setDate1(newDate1);
            if (!isNaN(newDate2)) setDate2(newDate2);
          } catch (err) {
            console.error('Fechas comparativas inválidas desde IA');
          }
        }
        if (acc.comando === 'simular_heatmap' && acc.metrica && acc.datos) {
          setMeteoroOverrides({ metrica: acc.metrica, datos: acc.datos });
          setIsHeatmapActive(true);
          setHeatmapMetric(acc.metrica);
        }
        if (acc.comando === 'limpiar_simulacion') {
          setMeteoroOverrides(null);
          setIsHeatmapActive(false);
          setIsComparing(false);
        }
      });
    };

    window.addEventListener('meteoro_action', handleMeteoroAction);
    
    const pendingActions = localStorage.getItem('pending_meteoro_actions');
    if (pendingActions) {
      try {
        const parsed = JSON.parse(pendingActions);
        handleMeteoroAction({ detail: parsed });
        localStorage.removeItem('pending_meteoro_actions');
      } catch (err) {
        localStorage.removeItem('pending_meteoro_actions');
      }
    }

    return () => window.removeEventListener('meteoro_action', handleMeteoroAction);
  }, [
    setIsHistoricalMode, setIsDynamicHistoricalMode, setIsPlaying, 
    setActiveLayer, setIsComparing, setDate1, setDate2, 
    setTimelineAnchorDate1, setTimelineAnchorDate, setIsHeatmapActive, setHeatmapMetric
  ]);
  // -------------------------

  // ─── Toggles de Sincronización ───
  const [syncTime, setSyncTime] = useState(true);
  const [syncMaps, setSyncMaps] = useState(true);
  const isSyncingRef = useRef(false);

  // ─── Sincronización Nativa de Cámaras (Anti-Infinite Loop) ───
  useEffect(() => {
    if (!isComparing || !syncMaps) return;
    
    const map1 = map1InstanceRef.current;
    const map2 = map2InstanceRef.current;
    if (!map1 || !map2) return;

    const handleMap1Move = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      map2.jumpTo({ center: map1.getCenter(), zoom: map1.getZoom(), bearing: map1.getBearing(), pitch: map1.getPitch() });
      isSyncingRef.current = false;
    };

    const handleMap2Move = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      map1.jumpTo({ center: map2.getCenter(), zoom: map2.getZoom(), bearing: map2.getBearing(), pitch: map2.getPitch() });
      isSyncingRef.current = false;
    };

    map1.on('move', handleMap1Move);
    map2.on('move', handleMap2Move);

    return () => {
      map1.off('move', handleMap1Move);
      map2.off('move', handleMap2Move);
    };
  }, [isComparing, syncMaps]);

  // ─── DEEP LINKING (Desde Módulo de Reportes) ───
  useEffect(() => {
    if (location.state) {
      if (location.state.date) {
        const d = new Date(location.state.date);
        setDate1(d);
        setTimelineAnchorDate1(d);
        if (syncTime) {
          setDate2(d);
          setTimelineAnchorDate2(d);
        }
      }
      if (location.state.layer) {
        setActiveLayer(location.state.layer);
      }
      if (location.state.location) {
        const loc = location.state.location;
        let flyOptions;
        let bbox = null;
        
        if (loc.geometry && (loc.geometry.type === 'Polygon' || loc.geometry.type === 'MultiPolygon' || loc.geometry.type === 'Feature' || loc.geometry.type === 'FeatureCollection')) {
          try {
            bbox = turf.bbox(loc.geometry);
          } catch(e) {}
        }
        
        // Timeout para asegurar que la referencia del mapa esté lista
        setTimeout(() => {
          if (bbox) {
            const fitOptions = { padding: 50, duration: 2000, essential: true };
            if (map1InstanceRef.current) {
              map1InstanceRef.current.fitBounds(bbox, fitOptions);
            }
            if (syncMaps && map2InstanceRef.current) {
              map2InstanceRef.current.fitBounds(bbox, fitOptions);
            }
          } else {
            flyOptions = { center: [loc.lon, loc.lat], zoom: 8, duration: 2000, essential: true };
            if (map1InstanceRef.current) {
              map1InstanceRef.current.flyTo(flyOptions);
            }
            if (syncMaps && map2InstanceRef.current) {
              map2InstanceRef.current.flyTo(flyOptions);
            }
          }
        }, 500);
      }
      
      // Limpiar state para evitar relanzamientos si el usuario navega internamente y vuelve
      window.history.replaceState({}, document.title);
    }
  }, [location.state, syncTime, syncMaps]);

  const mapStyle = theme === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11';

  const year1 = currentDate1.substring(0, 4);
  const month1 = currentDate1.substring(4, 6);
  const imageUrl1 = `${BASE_DATA_URL}/${activeLayer}/${year1}/${month1}/${currentDate1}.png`;

  const year2 = currentDate2.substring(0, 4);
  const month2 = currentDate2.substring(4, 6);
  const imageUrl2 = `${BASE_DATA_URL}/${activeLayer}/${year2}/${month2}/${currentDate2}.png`;


  // ─── Resolución Temporal Dinámica ───
  const getLayerStepHours = useCallback((layer) => {
    if (layer === 'evaporacion' || layer === 'visibilidad') return 6;
    return 1;
  }, []);

  const snapToValidHour = useCallback((date, layer) => {
    const step = getLayerStepHours(layer);
    if (step <= 1) return date;
    const snapped = new Date(date);
    const hour = snapped.getUTCHours();
    const remainder = hour % step;
    if (remainder !== 0) {
      // Redondear al múltiplo más cercano
      const down = hour - remainder;
      const up = down + step;
      snapped.setUTCHours(up - hour <= remainder ? Math.min(up, 23) : down);
    }
    return snapped;
  }, [getLayerStepHours]);

  // ─── Auto-Snap al cambiar de capa ───
  useEffect(() => {
    const step = getLayerStepHours(activeLayer);
    if (step > 1) {
      const snapped1 = snapToValidHour(date1, activeLayer);
      if (snapped1.getTime() !== date1.getTime()) {
        setDate1(snapped1);
        setTimelineAnchorDate1(snapped1);
      }
      const snapped2 = snapToValidHour(date2, activeLayer);
      if (snapped2.getTime() !== date2.getTime()) {
        setDate2(snapped2);
        setTimelineAnchorDate2(snapped2);
      }
    }
  }, [activeLayer]);

  // ─── Lógica de Renderizado de Timeline ───
  const renderTimeline = (date, setDate, anchorDate, setAnchorDate, isLeftMap) => {
    const ticks = [];
    const minTimeGlobal = new Date(MIN_DATE + 'T00:00:00Z').getTime();
    const maxTimeGlobal = new Date(MAX_DATE + 'T23:00:00Z').getTime();
    const stepHours = getLayerStepHours(activeLayer);
    
    // Rango dinámico: ±15 días en el paso de la variable activa
    const anchorSnapped = snapToValidHour(anchorDate, activeLayer);
    const maxTicks = Math.floor(360 / stepHours);
    for (let i = -maxTicks; i <= maxTicks; i++) {
      const tickTime = anchorSnapped.getTime() + (i * stepHours * 1000 * 60 * 60);
      if (tickTime >= minTimeGlobal && tickTime <= maxTimeGlobal) {
        ticks.push(new Date(tickTime));
      }
    }

    return (
      <TimelineSlider
        date={date}
        setDate={(d) => {
          if (syncTime) {
            setDate1(d);
            setDate2(d);
            setTimelineAnchorDate1(d);
            setTimelineAnchorDate2(d);
          } else {
            setDate(d);
            setAnchorDate(prevAnchor => {
              const diffHours = Math.abs(d.getTime() - prevAnchor.getTime()) / (1000 * 60 * 60);
              return diffHours > 240 ? d : prevAnchor;
            });
          }
        }}
        setIsPlaying={setIsPlaying}
        timelineTicks={ticks}
        minDate={MIN_DATE}
        maxDate={MAX_DATE}
        idPrefix={isLeftMap ? 'map1' : 'map2'}
        onDragStateChange={(isDragging) => { globalIsDraggingRef.current = isDragging; }}
      />
    );
  };

  // ─── Bucle de Reproducción (Timelapse) ───
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      const advanceDate = (prev, setAnchor) => {
        const stepHours = getLayerStepHours(activeLayer);
        const nextDate = new Date(prev);
        nextDate.setUTCHours(nextDate.getUTCHours() + stepHours);
        
        const minTime = new Date(MIN_DATE + 'T00:00:00Z').getTime();
        const maxTime = new Date(MAX_DATE + 'T23:00:00Z').getTime();
        
        let resultDate = nextDate;
        if (nextDate.getTime() > maxTime) {
          resultDate = new Date(minTime);
        } else if (nextDate.getTime() < minTime) {
          resultDate = new Date(maxTime);
        }
        
        setAnchor(resultDate);
        return resultDate;
      };

      setDate1(prev => advanceDate(prev, setTimelineAnchorDate1));
      if (!syncTime && isComparing) {
        setDate2(prev => advanceDate(prev, setTimelineAnchorDate2));
      } else if (syncTime && isComparing) {
        setDate2(prev => advanceDate(prev, setTimelineAnchorDate2));
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying, activeLayer, syncTime, isComparing, getLayerStepHours]);

  // ─── MAPA 1: Cargar imagen PNG o JSON puntual ───
  useEffect(() => {
    if (!imageUrl1) return;

    if (activeLayer === 'aqi') {
      const fetchAqi = async () => {
        try {
          const jsonUrl = `${BASE_DATA_URL}/aqi/${year1}/${month1}/${currentDate1}.json`;
          const response = await fetch(jsonUrl);
          if (!response.ok) throw new Error('JSON no encontrado');
          const data = await response.json();

          const geoJson = {
            type: 'FeatureCollection',
            features: data.map(item => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [item.lon, item.lat] },
              properties: { aqi_value: item.aqi }
            }))
          };
          setAqiGeoJson(geoJson);
        } catch (error) {
          console.error("Error cargando AQI Map 1:", error);
          setAqiGeoJson(null);
        }
      };
      fetchAqi();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl1;
    
    let isCancelled = false;

    img.onload = () => {
      if (isCancelled) return;
      
      const isFastMoving = isPlayingRef.current || globalIsDraggingRef.current;
      
      if (!isFastMoving) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvasCtx1Ref.current = ctx;
        canvasSize1Ref.current = { width: img.width, height: img.height };

        if (activeLayer === 'viento') {
          setWindPixels(ctx.getImageData(0, 0, img.width, img.height).data);
        } else {
          setWindPixels(null);
        }
      }

      if (layerMap1Ref.current && layerMap1Ref.current._gl) {
        const gl = layerMap1Ref.current._gl;
        gl.bindTexture(gl.TEXTURE_2D, layerMap1Ref.current._dataTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (map1InstanceRef.current) map1InstanceRef.current.triggerRepaint();
      } else {
        if (layerMap1Ref.current) layerMap1Ref.current._pendingImg = img;
      }
    };
    
    return () => {
      isCancelled = true;
      img.onload = null;
      img.src = '';
    };
  }, [imageUrl1, activeLayer]);

  // ─── MAPA 2: Cargar imagen PNG o JSON puntual ───
  useEffect(() => {
    if (!imageUrl2 || !isComparing) return;

    if (activeLayer === 'aqi') {
      return; // AQI geojson compartido, no refetch por ahora.
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl2;
    
    let isCancelled = false;

    img.onload = () => {
      if (isCancelled) return;
      
      const isFastMoving = isPlayingRef.current || globalIsDraggingRef.current;
      
      if (!isFastMoving) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvasCtx2Ref.current = ctx;
        canvasSize2Ref.current = { width: img.width, height: img.height };

        if (activeLayer === 'viento') {
          setWindPixels2(ctx.getImageData(0, 0, img.width, img.height).data);
        } else {
          setWindPixels2(null);
        }
      }

      if (layerMap2Ref.current && layerMap2Ref.current._gl) {
        const gl = layerMap2Ref.current._gl;
        gl.bindTexture(gl.TEXTURE_2D, layerMap2Ref.current._dataTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (map2InstanceRef.current) map2InstanceRef.current.triggerRepaint();
      } else {
        if (layerMap2Ref.current) layerMap2Ref.current._pendingImg = img;
      }
    };
    
    return () => {
      isCancelled = true;
      img.onload = null;
      img.src = '';
    };
  }, [imageUrl2, activeLayer, isComparing]);

  // ─── MAPA 1: Forzar actualización de Canvas 2D al pausar ───
  useEffect(() => {
    if (!isPlaying && !globalIsDraggingRef.current && imageUrl1 && activeLayer !== 'aqi') {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl1;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvasCtx1Ref.current = ctx;
        canvasSize1Ref.current = { width: img.width, height: img.height };
        if (activeLayer === 'viento') {
          setWindPixels(ctx.getImageData(0, 0, img.width, img.height).data);
        } else {
          setWindPixels(null);
        }
      };
    }
  }, [isPlaying, imageUrl1, activeLayer]);

  // ─── MAPA 2: Forzar actualización de Canvas 2D al pausar ───
  useEffect(() => {
    if (!isPlaying && !globalIsDraggingRef.current && imageUrl2 && activeLayer !== 'aqi' && isComparing) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl2;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvasCtx2Ref.current = ctx;
        canvasSize2Ref.current = { width: img.width, height: img.height };
        if (activeLayer === 'viento') {
          setWindPixels2(ctx.getImageData(0, 0, img.width, img.height).data);
        } else {
          setWindPixels2(null);
        }
      };
    }
  }, [isPlaying, imageUrl2, activeLayer, isComparing]);

  // ─── Network Preloading (Siguiente fotograma) ───
  useEffect(() => {
    if (isPlaying && activeLayer !== 'aqi') {
      const stepHours = getLayerStepHours(activeLayer);
      const nextDate = new Date(date1);
      nextDate.setUTCHours(nextDate.getUTCHours() + stepHours);
      
      const yyyy = nextDate.getUTCFullYear();
      const mm = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
      const backendDate = formatBackendDate(nextDate);
      
      const nextImageUrl = `${BASE_DATA_URL}/${activeLayer}/${yyyy}/${mm}/${backendDate}.png`;
      const preImg = new Image();
      preImg.src = nextImageUrl;
    }
  }, [date1, activeLayer, isPlaying, getLayerStepHours, formatBackendDate]);

  // ─── Actualizar ref y paleta cuando cambia la capa ───
  useEffect(() => {
    activeLayerRef.current = activeLayer;

    const updateLayer = (layerRef, instanceRef) => {
      if (!layerRef.current || !layerRef.current._gl) return;
      if (activeLayer === 'aqi') return; // AQI no usa paleta WebGL

      const gl = layerRef.current._gl;

      // Limpieza Inmediata de Textura (Evitar Flash de Color Sólido)
      const emptyPixels = new Uint8Array([0, 0, 0, 0]);
      gl.bindTexture(gl.TEXTURE_2D, layerRef.current._dataTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyPixels);

      const stops = COLOR_RAMPS[activeLayer] || COLOR_RAMPS.visibilidad;
      const pixels = buildRampPixels(stops, activeLayer);
      gl.bindTexture(gl.TEXTURE_2D, layerRef.current._rampTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      if (instanceRef.current) instanceRef.current.triggerRepaint();
    };

    updateLayer(layerMap1Ref, map1InstanceRef);
    updateLayer(layerMap2Ref, map2InstanceRef);
  }, [activeLayer]);

  // ─── Montar/desmontar el CustomLayer en Mapbox ───
  const handleMapLoad = useCallback((e, isMap2 = false) => {
    const rawMap = e.target;
    if (isMap2) map2InstanceRef.current = rawMap;
    else map1InstanceRef.current = rawMap;

    // Detectar firstSymbolId
    const layers = rawMap.getStyle().layers;
    const sym = layers.find(l => l.type === 'symbol' || l.id.includes('admin'));
    if (sym && !isMap2) setFirstSymbolId(sym.id);

    // Definir el CustomLayer usando la factoría
    const layerDef = createHistoricalLayer(
      isMap2 ? 'historico-custom-webgl-2' : 'historico-custom-webgl-1', 
      activeLayerRef
    );

    if (isMap2) layerMap2Ref.current = layerDef;
    else layerMap1Ref.current = layerDef;

    // Insertar debajo de las etiquetas
    const insertBefore = sym ? sym.id : undefined;
    if (!rawMap.getLayer(layerDef.id)) {
      rawMap.addLayer(layerDef, insertBefore);
    }

    // Capa de costas (idéntica a layerManager.js)
    if (!rawMap.getLayer('historico-coastline')) {
      rawMap.addLayer({
        id: 'historico-coastline',
        type: 'line',
        source: 'composite',
        'source-layer': 'water',
        paint: { 'line-color': 'rgba(0, 0, 0, 0.4)', 'line-width': 1.5 }
      }, insertBefore);
    }
  }, []);

  // ─── Limpiar al desmontar ───
  useEffect(() => {
    return () => {
      [map1InstanceRef, map2InstanceRef].forEach((ref, idx) => {
        const map = ref.current;
        if (map && map.getStyle()) {
          try {
            const layerId = idx === 0 ? 'historico-custom-webgl-1' : 'historico-custom-webgl-2';
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getLayer('historico-coastline')) map.removeLayer('historico-coastline');
          } catch (_) { /* ignore */ }
        }
      });
      layerMap1Ref.current = null;
      layerMap2Ref.current = null;
      map1InstanceRef.current = null;
      map2InstanceRef.current = null;
    };
  }, []);

  // ─── Pop-up: lectura de datos ───
  const handleMapClick = useCallback((evt, isMap2 = false) => {
    const { lng, lat } = evt.lngLat;

    if (activeLayer === 'aqi') {
      const map = evt.target;
      const features = map.queryRenderedFeatures(evt.point, { layers: ['aqi-circle-layer'] });
      if (features && features.length > 0) {
        const aqiVal = features[0].properties.aqi_value;
        setPopupInfo({ lng, lat, value: Math.round(aqiVal).toString(), unit: 'AQI', layer: activeLayer, isMap2 });
      }
      return;
    }

    if (lat > 85.051 || lat < -85.051) return;
    
    // 1. Determinar de qué canvas leer basado en en qué mapa se hizo clic
    const currentCanvasCtx = isMap2 ? canvasCtx2Ref.current : canvasCtx1Ref.current;
    const currentCanvasSize = isMap2 ? canvasSize2Ref.current : canvasSize1Ref.current;

    if (!currentCanvasCtx || !currentCanvasSize.width) return;

    const { width, height } = currentCanvasSize;
    // Normalización idéntica a _geoToTexel de windMath.js
    const normLng = ((lng % 360) + 540) % 360 - 180;
    const normLat = Math.max(-90, Math.min(90, lat));
    // La imagen cruda viene con lat -90 en fila 0 (sur arriba)
    
    const shiftLayers = ['evaporacion'];
    const shiftAmount = shiftLayers.includes(activeLayer) ? 0.5 : 0.0;
    
    let u = ((normLng + 180) / 360) + shiftAmount;
    u = u - Math.floor(u); // Equivalente JS a fract()
    const pxX = Math.floor(u * width);
    const pxY = Math.floor(((normLat + 90) / 180) * height);

    const pixelData = currentCanvasCtx.getImageData(
      Math.min(pxX, width - 1), Math.min(pxY, height - 1), 1, 1
    ).data;
    const rawValue = pixelData[0];

    let displayValue = '', displayUnit = '';
    if (activeLayer === 'visibilidad') {
      displayValue = ((rawValue / 255.0) * 24.14).toFixed(1); displayUnit = 'km';
    } else if (activeLayer === 'humedad') {
      displayValue = ((rawValue / 255.0) * 100.0).toFixed(1); displayUnit = '%';
    } else if (activeLayer === 'rayos') {
      displayValue = ((rawValue / 255.0) * 100.0).toFixed(1); displayUnit = '% max';
    } else if (activeLayer === 'uv') {
      displayValue = ((rawValue / 255.0) * 16.0).toFixed(1); displayUnit = 'UVI';
    } else if (activeLayer === 'isobaras') {
      displayValue = ((rawValue / 255.0) * 150.0 + 900.0).toFixed(0); displayUnit = 'hPa';
    } else if (activeLayer === 'temperatura') {
      displayValue = ((rawValue / 255.0) * 120.0 - 60.0).toFixed(1); displayUnit = '°C';
    } else if (activeLayer === 'lluvia') {
      displayValue = ((rawValue / 255.0) * 20.0).toFixed(1); displayUnit = 'mm/h';
    } else if (activeLayer === 'nieve') {
      displayValue = ((rawValue / 255.0) * 150.0).toFixed(1); displayUnit = 'cm';
    } else if (activeLayer === 'evaporacion') {
      displayValue = ((rawValue / 255.0) * 500.0).toFixed(1); displayUnit = 'W/m²';
    } else if (activeLayer === 'viento') {
      const u_norm = pixelData[0] / 255.0;
      const v_norm = pixelData[1] / 255.0;
      const u_ms = (u_norm * 200.0) - 100.0;
      const v_ms = (v_norm * 200.0) - 100.0;
      const speed_ms = Math.sqrt(u_ms * u_ms + v_ms * v_ms);
      displayValue = (speed_ms * 3.6).toFixed(1); displayUnit = 'km/h';
    } else {
      displayValue = rawValue.toString(); displayUnit = 'bits';
    }

    setPopupInfo({ lng, lat, value: displayValue, unit: displayUnit, layer: activeLayer, isMap2 });
  }, [activeLayer]);

  // ─── LEYENDA ───
  const renderLegend = () => {
    const legends = {
      rayos: { gradient: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 20%, rgba(255,255,0,0.8) 30%, rgba(255,128,0,0.9) 60%, rgba(255,0,255,1) 100%)', labels: ['0', '', 'Mod', 'Alta', 'Ext'] },
      visibilidad: { gradient: 'linear-gradient(to right, rgba(150,45,0,0.9) 0%, rgba(230,90,0,0.8) 4%, rgba(255,150,50,0.7) 12%, rgba(255,220,180,0.5) 41%, rgba(0,0,0,0) 100%)', labels: ['0', '1', '3', '10', '24+ km'] },
      humedad: { gradient: 'linear-gradient(to right, rgba(133,68,0,0.8) 0%, rgba(196,146,63,0.8) 20%, rgba(255,255,255,0.8) 40%, rgba(65,157,148,0.8) 60%, rgba(13,100,93,0.8) 80%, rgba(3,59,54,0.9) 100%)', labels: ['0', '20', '40', '60', '80', '100%'] },
      uv: { gradient: 'linear-gradient(to right, rgba(149,231,68,0) 0%, rgba(149,231,68,0.8) 6%, rgba(208,209,2,0.8) 20%, rgba(243,107,0,0.8) 40%, rgba(220,0,0,0.8) 53%, rgba(245,0,140,0.8) 73%, rgba(0,214,255,0.9) 100%)', labels: ['0', '1', '3', '6', '8', '11', '15+'] },
      aqi: { gradient: 'linear-gradient(to right, #7dd3ff 0%, #00e400 10%, #ffff00 20%, #ff7e00 30%, #ff0000 40%, #8f3f97 60%, #7e0023 100%)', labels: ['0', '50', '100', '150', '200', '300+'] },
      isobaras: { gradient: 'repeating-linear-gradient(to right, rgba(255,255,255,0.8) 0px, rgba(255,255,255,0.8) 2px, transparent 2px, transparent 20px)', labels: ['900', '950', '1000', '1050 hPa'] },
      temperatura: { gradient: 'linear-gradient(to right, #e6e6fa 0%, #9999ff 25%, #4a0080 41%, #00ff00 50%, #ffff00 62%, #ff8800 71%, #ff0000 79%, #800000 100%)', labels: ['-60', '-30', '0', '25', '60 °C'] },
      lluvia: { gradient: 'linear-gradient(to right, rgba(0,255,255,0) 0%, rgba(0,255,255,1) 5%, rgba(0,100,255,1) 10%, rgba(0,0,255,1) 25%, rgba(100,0,200,1) 50%, rgba(180,0,180,1) 75%, rgba(255,0,255,1) 100%)', labels: ['0', '2', '5', '10', '20+ mm/h'] },
      nieve: { gradient: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 5%, rgba(174,239,255,1) 10%, rgba(114,227,255,1) 20%, rgba(63,212,245,1) 33%, rgba(28,184,231,1) 50%, rgba(19,108,181,1) 80%, rgba(64,12,112,1) 100%)', labels: ['0', '15', '30', '75', '150+ cm'] },
      viento: { gradient: 'linear-gradient(to right, rgba(51,51,255,0) 0%, rgba(51,51,255,1) 5%, rgba(46,139,87,1) 15%, rgba(173,255,47,1) 30%, rgba(255,255,0,1) 40%, rgba(255,136,0,1) 50%, rgba(255,69,0,1) 60%, rgba(139,0,0,1) 75%, rgba(255,0,255,1) 90%, rgba(255,182,193,1) 100%)', labels: ['0', '20', '50', '80', '100', '140 km/h'] },
      evaporacion: { gradient: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(200,220,255,0.5) 10%, rgba(160,200,240,0.6) 25%, rgba(130,170,220,0.75) 40%, rgba(180,190,200,0.8) 55%, rgba(210,210,215,0.85) 70%, rgba(235,235,240,0.9) 85%, rgba(255,255,255,0.95) 100%)', labels: ['0', '50', '125', '200', '275', '350', '425', '500 W/m²'] },
    };
    const leg = legends[activeLayer];
    if (!leg) return null;
    return (
      <div style={{ marginTop: '20px' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Leyenda</p>
        <div style={{ width: '100%', height: '14px', background: leg.gradient, borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {leg.labels.map((lbl, i) => <span key={i}>{lbl}</span>)}
        </div>
      </div>
    );
  };

  const minTimeGlobal = new Date(MIN_DATE + 'T00:00:00Z').getTime();
  const maxTimeGlobal = new Date(MAX_DATE + 'T23:00:00Z').getTime();
  const totalHours = Math.floor((maxTimeGlobal - minTimeGlobal) / (1000 * 60 * 60));
  const currentHourOffset = Math.floor((date1.getTime() - minTimeGlobal) / (1000 * 60 * 60));

  const formattedDateString = new Intl.DateTimeFormat("es-ES", { 
    weekday: 'long', 
    year: 'numeric',
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: 'UTC' 
  }).format(date1);
  const formattedText = formattedDateString.replace(', ', ' - ') + ' UTC';
  const finalFormattedText = formattedText.charAt(0).toUpperCase() + formattedText.slice(1);

  const handlePanTimeline = (direction) => {
    setTimelineAnchorDate(prev => {
      const nextDate = new Date(prev);
      nextDate.setUTCHours(nextDate.getUTCHours() + (direction * 24));
      
      const minTime = new Date(MIN_DATE + 'T00:00:00Z').getTime();
      const maxTime = new Date(MAX_DATE + 'T23:00:00Z').getTime();
      
      if (nextDate.getTime() > maxTime) return new Date(maxTime);
      if (nextDate.getTime() < minTime) return new Date(minTime);
      return nextDate;
    });
  };

  const renderFloatingControls = (isMap2) => (
    <>
      <div style={{ position: 'absolute', top: '90px', left: isMap2 ? '20px' : 'calc(var(--sidebar-width, 250px) + 20px)', zIndex: 50 }}>
        <BuscadorEspacial mapRef={isMap2 ? map2InstanceRef : map1InstanceRef} />
      </div>

      <div style={{
        position: 'absolute', top: '90px', right: '120px', zIndex: 50,
        background: 'var(--card)', 
        padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        pointerEvents: 'auto', boxShadow: 'var(--shadow-md)'
      }}>
        <input 
          type="date" 
          min={MIN_DATE} max={MAX_DATE}
          value={(isMap2 ? date2 : date1).toISOString().split('T')[0]}
          onChange={e => {
            const newDate = new Date(e.target.value + 'T00:00:00Z');
            newDate.setUTCHours((isMap2 ? date2 : date1).getUTCHours());
            const snapped = snapToValidHour(newDate, activeLayer);
            
            if (syncTime) {
              setDate1(snapped);
              setDate2(snapped);
              setTimelineAnchorDate1(snapped);
              setTimelineAnchorDate2(snapped);
            } else {
              if (isMap2) {
                setDate2(snapped);
                setTimelineAnchorDate2(snapped);
              } else {
                setDate1(snapped);
                setTimelineAnchorDate1(snapped);
              }
            }
          }}
          style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '13px' }}
        />
      </div>
    </>
  );

  const renderMapContent = (isMap2) => (
    <>
      <FullscreenControl position="top-right" />
      <NavigationControl position="top-right" />

      {activeLayer === 'viento' && (
        <HistoricalWindParticles 
          isActive={true} 
          windPixels={isMap2 ? windPixels2 : windPixels} 
        />
      )}

      
      {/* ─── MIGRATION: CAPAS DE SUPERPOSICIÓN (HEATMAP Y SENSORES) ─── */}
      {!isMap2 && isHeatmapActive && (
        <VoronoiLayer metrica={heatmapMetric} umbrales={umbrales} cities={citiesData} activeFilter={null} />
      )}
      {!isMap2 && showSensors && (
        <MarkersLayer
          cities={citiesData} metrica={heatmapMetric} umbrales={umbrales}
          activeFilter={null} unidad={unidades?.[heatmapMetric]}
          currentZoom={3.5} onCityClick={(city) => setSelectedCity(city)}
        />
      )}
      {!isMap2 && (isSimMode || zonaSimActiva) && fronterasSeleccionadas && fronterasSeleccionadas.map((frontera, idx) => {
        const simData = zonaSimZonas && zonaSimZonas.find(z => z.nombre === frontera.nombre);
        const color = simData?.color || (idx === 0 ? '#38bdf8' : '#a855f7');
        return (
          <Source key={`frontera-src-${idx}`} id={`frontera-source-m1-${idx}`} type="geojson" data={frontera.geojson}>
            <Layer id={`frontera-fill-m1-${idx}`} type="fill" paint={{ 'fill-color': color, 'fill-opacity': simData ? 0.3 : 0.2 }} />
            <Layer id={`frontera-line-m1-${idx}`} type="line" paint={{ 'line-color': color, 'line-width': 2 }} />
          </Source>
        );
      })}

      {/* ─── CAPA VECTORIAL AQI ─── */}
      {!isMap2 && activeLayer === 'aqi' && aqiGeoJson && (
        <Source id="aqi-vector-source" type="geojson" data={aqiGeoJson}>
          <Layer
            id="aqi-circle-layer"
            type="circle"
            beforeId={firstSymbolId}
            paint={{
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                3, 8,
                8, 22
              ],
              'circle-color': [
                'step', ['get', 'aqi_value'],
                '#7dd3ff', 10, '#00e400', 50, '#ffff00', 100, '#ff7e00', 150, '#ff0000', 200, '#8f3f97', 300, '#7e0023'
              ],
              'circle-stroke-width': 2.5,
              'circle-stroke-color': 'rgba(255, 255, 255, 0.85)',
              'circle-opacity': 0.95
            }}
          />
          <Layer
            id="aqi-symbol-layer"
            type="symbol"
            beforeId={firstSymbolId}
            layout={{
              'text-field': ['to-string', ['round', ['get', 'aqi_value']]],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                3, 10,
                8, 14
              ]
            }}
            paint={{
              'text-color': '#000000',
              'text-halo-color': 'rgba(255,255,255,0.8)',
              'text-halo-width': 1
            }}
          />
        </Source>
      )}

      {/* POP-UP UNIFICADO */}
      {popupInfo && popupInfo.isMap2 === isMap2 && (
        <Popup
          longitude={popupInfo.lng}
          latitude={popupInfo.lat}
          closeButton={true}
          closeOnClick={false}
          onClose={() => setPopupInfo(null)}
          anchor="bottom"
          className="premium-weather-popup"
        >
          <div className="scalar-popup-content" style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)' }}>
            <div className="scalar-popup-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', borderBottom: 'none' }}>
              <span className="scalar-popup-label" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{popupInfo.layer.toUpperCase()}</span>
              <div className="scalar-popup-value-container" style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span className="scalar-popup-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-light)' }}>{popupInfo.value}</span>
                <span className="scalar-popup-unit" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{popupInfo.unit}</span>
              </div>
            </div>
          </div>
        </Popup>
      )}

    </>
  );

  return (
    <div className="mapa-page-container" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}>
      <div className="map-container" style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: isComparing ? 'row' : 'column' }}>
        
        
        {/* MAPA 1 */}
        <div style={{ flex: 1, position: 'relative', borderRight: isComparing ? '2px solid rgba(255,255,255,0.2)' : 'none' }}>
          {isSimMode && (
            <FronterasPanel
              onBoundarySelect={handleBoundarySelect}
              onStartSimulation={handleStartSimulation}
              isRunning={zonaSimActiva}
            />
          )}
          <ModalSimulacion
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            fronteras={fronterasParaSimular}
            onStart={(cfg) => iniciarZona(cfg)}
          />
          <ModalInyeccion
            isOpen={isInjectModalOpen}
            onClose={() => setIsInjectModalOpen(false)}
          />

          {renderFloatingControls(false)}
          <Map
            key={`map1-${theme}`}
            style={{ width: '100%', height: '100%' }}
            initialViewState={{ longitude: -60.0, latitude: -20.0, zoom: 3.5 }}
            onClick={(e) => handleMapClick(e, false)}
            onLoad={(e) => handleMapLoad(e, false)}
            mapStyle={mapStyle}
            mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
            attributionControl={false}
            projection="mercator"
          >
            {renderMapContent(false)}
          </Map>
        </div>

        {/* MAPA 2 */}
        {isComparing && (
          <div style={{ flex: 1, position: 'relative' }}>
            {renderFloatingControls(true)}
            <Map
              key={`map2-${theme}`}
              style={{ width: '100%', height: '100%' }}
              initialViewState={{ longitude: -60.0, latitude: -20.0, zoom: 3.5 }}
              onClick={(e) => handleMapClick(e, true)}
              onLoad={(e) => handleMapLoad(e, true)}
              mapStyle={mapStyle}
              mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
              attributionControl={false}
              projection="mercator"
            >
              {renderMapContent(true)}
            </Map>
          </div>
        )}

        
        <CityHistoryPanel
          activeCity={selectedCity}
          setSelectedCity={setSelectedCity}
          isRunning={zonaSimActiva}
          unidades={unidades}
          formatearValor={formatearValor}
          getDynamicColor={() => '#aaa'}
        />

        <ControlPanel
          activeControlsCount={[isParticlesActive, isHeatmapActive, isChoroplethActive, showSensors, isSimMode].filter(Boolean).length}
          setIsInjectModalOpen={setIsInjectModalOpen}
          isSimMode={isSimMode} handleToggleSimMode={handleToggleSimMode}
          isParticlesActive={isParticlesActive} setIsParticlesActive={setIsParticlesActive}
          isHeatmapActive={isHeatmapActive} setIsHeatmapActive={setIsHeatmapActive}
          heatmapMetric={heatmapMetric} setHeatmapMetric={setHeatmapMetric}
          isChoroplethActive={isChoroplethActive} setIsChoroplethActive={setIsChoroplethActive}
          isHistoricalMode={false} setIsHistoricalMode={() => {}}
          showSensors={showSensors} setShowSensors={setShowSensors} setSelectedCity={setSelectedCity}
          iotLoading={false}
          unidades={unidades} cambiarUnidad={() => {}} METRICAS_UNIDADES={METRICAS_UNIDADES}
          isDynamicHistoricalMode={false} setIsDynamicHistoricalMode={() => {}}
          isCompareMode={isComparing} setIsCompareMode={setIsComparing}
          compareIndexA={0} compareIndexB={0}
          setCompareIndexA={() => {}} setCompareIndexB={() => {}}
          globalTimelineIndex={0} globalHistoryArray={[]}
          particleFilters={particleFilters} setParticleFilters={setParticleFilters}
        />

        {/* ─── PANELES DE CONTROL (Time Machine & Timeline) ─── */}
        
        {/* Selector Rápido Superior (Time Machine) -> Reubicado Abajo a la Derecha */}
        <div style={{ 
          position: 'absolute', bottom: '130px', right: 20, zIndex: 20, 
          background: 'var(--card)', 
          padding: '1.25rem', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', 
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          minWidth: '220px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Modo Histórico</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => setIsComparing(!isComparing)}
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius)', border: 'none',
                background: isComparing ? 'var(--rust)' : 'var(--moss)',
                color: 'var(--white)', fontWeight: '600', cursor: 'pointer',
                transition: 'background 0.2s, transform 0.1s',
                fontSize: '13px'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isComparing ? 'Desactivar Comparación' : 'Comparar Mapas'}
            </button>
            <button
              onClick={() => navigate('/reportes')}
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)',
                background: 'var(--paper)',
                color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer',
                transition: 'background 0.2s',
                fontSize: '13px'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--paper)'}
            >
              Ir a Reportes
            </button>
            
            {isComparing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--paper-2)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={syncTime} onChange={e => setSyncTime(e.target.checked)} />
                  Sincronizar Tiempo
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={syncMaps} onChange={e => setSyncMaps(e.target.checked)} />
                  Sincronizar Vistas
                </label>
              </div>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 500 }}>
              Variable Atmosférica:
              <select
                value={activeLayer}
                onChange={e => setActiveLayer(e.target.value)}
                style={{ 
                  marginTop: '6px', padding: '8px 10px', 
                  background: 'var(--paper)', color: 'var(--text-primary)', 
                  border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                  outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '13px'
                }}
              >
                <option value="visibilidad">Visibilidad</option>
                <option value="viento">Velocidad del Viento</option>
                <option value="uv">Índice UV</option>
                <option value="humedad">Humedad Relativa</option>
                <option value="isobaras">Presión (Isobaras)</option>
                <option value="temperatura">Temperatura</option>
                <option value="lluvia">Precipitación (Lluvia)</option>
                <option value="nieve">Acumulación de Nieve</option>
                <option value="evaporacion">Evaporación (Calor Latente)</option>
              </select>
            </label>
          </div>
          {renderLegend()}
        </div>

        {/* Barra de Reproducción Inferior (Timeline UI) */}
        <div style={{
          position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'var(--card)', backdropFilter: 'none',
          padding: '16px 24px', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', gap: '15px',
          width: '90%', maxWidth: '800px'
        }}>
          {/* Fila superior: Info de Fecha (Estilo Meteored) */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', letterSpacing: '0.5px' }}>
            {finalFormattedText}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? 'var(--rust)' : 'var(--moss)',
                color: 'var(--white)', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius)',
                cursor: 'pointer', fontWeight: 600, fontSize: '15px', minWidth: '90px',
                transition: 'background 0.2s, transform 0.1s', boxShadow: 'var(--shadow-md)'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isPlaying ? 'Pausa' : 'Play'}
            </button>
            {(!isComparing || syncTime) ? (
              renderTimeline(date1, setDate1, timelineAnchorDate1, setTimelineAnchorDate1, true)
            ) : (
              <div style={{ flex: 1, display: 'flex', width: '100%', gap: '20px', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {renderTimeline(date1, setDate1, timelineAnchorDate1, setTimelineAnchorDate1, true)}
                </div>
                <div style={{ width: '2px', background: 'var(--line)', margin: '10px 0' }} />
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {renderTimeline(date2, setDate2, timelineAnchorDate2, setTimelineAnchorDate2, false)}
                </div>
              </div>
            )}
          </div>
        </div>

      
      <SimulationStatus
        zonaSimActiva={zonaSimActiva}
        zonaSimZonas={zonaSimZonas}
        zonaSimUnidad={zonaSimUnidad}
        zonaSimEscNombre={zonaSimEscNombre}
        zonaSimMetrica={zonaSimMetrica}
        zonaSimProgreso={zonaSimProgreso}
        zonaSimTiempo={zonaSimTiempo}
        zonaSimSesionId={zonaSimSesionId}
        zonaSimTotalLecturas={zonaSimTotalLecturas}
        detenerZona={detenerZona}
      />

      </div>
    </div>
  );
}

export default MapaMonitoreo;
