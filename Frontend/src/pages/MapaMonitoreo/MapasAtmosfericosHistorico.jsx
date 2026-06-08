import { useState, useRef, useEffect, useCallback } from 'react';
import Map, { NavigationControl, FullscreenControl, Popup, Layer, Source } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '../../context/ThemeContext';
import './MapaMonitoreo.css';
import HistoricalWindParticles from '../../components/MapaMonitoreo/HistoricalWindParticles';

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
  varying vec2 v_mercator;
  const float PI = 3.14159265359;

  void main() {
    float wrappedX = fract(v_mercator.x);
    float lon = wrappedX * 360.0 - 180.0;
    float merc_y = PI * (1.0 - 2.0 * v_mercator.y);
    float ex = exp(merc_y);
    float lat = atan((ex - 1.0 / ex) * 0.5) * (180.0 / PI);

    float u = (lon + 180.0) / 360.0;
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
// COMPONENTE PRINCIPAL
// =======================================================
const MIN_DATE = '2024-01-01';
const MAX_DATE = new Date().toISOString().split('T')[0];

function MapasAtmosfericosHistorico() {
  const { theme } = useTheme();

  const [selectedDate, setSelectedDate] = useState(new Date('2024-01-01T00:00:00Z'));
  const [timelineAnchorDate, setTimelineAnchorDate] = useState(new Date('2024-01-01T00:00:00Z'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLayer, setActiveLayer] = useState('lluvia');
  const activeLayerRef = useRef(activeLayer);
  const [aqiGeoJson, setAqiGeoJson] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [firstSymbolId, setFirstSymbolId] = useState(null);
  const [windPixels, setWindPixels] = useState(null);

  const formatBackendDate = useCallback((date) => {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}00`;
  }, []);

  const currentDate = formatBackendDate(selectedDate);

  const canvasCtxRef = useRef(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const customLayerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const scrollRef = useRef(null);

  const [viewState, setViewState] = useState({
    longitude: -60.0, latitude: -20.0, zoom: 3.5
  });

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const isDraggingRef = useRef(false);

  // ─── Función de Snap Magnético: busca el Tick más cercano al centro ───
  const snapToNearestTick = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    const children = container.children;
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

    if (closestChild && closestChild.id && closestChild.id.startsWith('tick-')) {
      const timestamp = parseInt(closestChild.id.replace('tick-', ''));
      if (!isNaN(timestamp)) {
        const snappedDate = new Date(timestamp);
        // Clamp a límites globales
        const minTime = new Date(MIN_DATE + 'T00:00:00Z').getTime();
        const maxTime = new Date(MAX_DATE + 'T23:00:00Z').getTime();
        if (timestamp >= minTime && timestamp <= maxTime) {
          setSelectedDate(snappedDate);
          
          // Actualización Silenciosa del Ancla (Lazy Loading Inteligente)
          // Si el usuario se alejó más de 10 días (240 horas) del ancla actual,
          // regeneramos la pista para que siempre tenga 5 días de margen antes del borde.
          setTimelineAnchorDate(prevAnchor => {
            const diffHours = Math.abs(snappedDate.getTime() - prevAnchor.getTime()) / (1000 * 60 * 60);
            if (diffHours > 240) {
              return snappedDate;
            }
            return prevAnchor;
          });
        }
      }
    }
  }, []);

  const handleMouseDown = (e) => {
    setIsPlaying(false); // Pausa Automática al Tocar
    setIsDragging(true);
    isDraggingRef.current = true;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      setIsDragging(false);
      isDraggingRef.current = false;
      snapToNearestTick();
    }
  };
  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      setIsDragging(false);
      isDraggingRef.current = false;
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

  const mapStyle = theme === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11';

  const year = currentDate.substring(0, 4);
  const month = currentDate.substring(4, 6);
  const imageUrl = `http://localhost:8080/${activeLayer}/${year}/${month}/${currentDate}.png`;

  // ─── Generación de Ticks para Cinta Métrica ───
  const generateTimelineTicks = useCallback(() => {
    const ticks = [];
    const minTimeGlobal = new Date(MIN_DATE + 'T00:00:00Z').getTime();
    const maxTimeGlobal = new Date(MAX_DATE + 'T23:00:00Z').getTime();
    
    // Generar ±15 días (±360 horas) desde timelineAnchorDate
    for (let i = -360; i <= 360; i++) {
      const tickTime = timelineAnchorDate.getTime() + (i * 1000 * 60 * 60);
      
      if (tickTime >= minTimeGlobal && tickTime <= maxTimeGlobal) {
        const tickDate = new Date(tickTime);
        ticks.push(tickDate);
      }
    }
    return ticks;
  }, [timelineAnchorDate]);

  const timelineTicks = generateTimelineTicks();

  // ─── Bucle de Reproducción (Timelapse) ───
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSelectedDate(prev => {
        const nextDate = new Date(prev);
        nextDate.setUTCHours(nextDate.getUTCHours() + 1);
        
        const minTime = new Date(MIN_DATE + 'T00:00:00Z').getTime();
        const maxTime = new Date(MAX_DATE + 'T23:00:00Z').getTime();
        
        let resultDate = nextDate;
        if (nextDate.getTime() > maxTime) {
          resultDate = new Date(minTime);
        } else if (nextDate.getTime() < minTime) {
          resultDate = new Date(maxTime);
        }
        
        setTimelineAnchorDate(resultDate);
        return resultDate;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // ─── Ruleta Auto-Centrado (solo si NO estamos arrastrando) ───
  useEffect(() => {
    if (isDraggingRef.current) return;
    const activeTickId = `tick-${selectedDate.getTime()}`;
    const element = document.getElementById(activeTickId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDate, timelineTicks]);

  // ─── Cargar imagen PNG o JSON puntual ───
  useEffect(() => {
    if (!imageUrl) return;

    if (activeLayer === 'aqi') {
      const fetchAqi = async () => {
        try {
          const jsonUrl = `http://localhost:8080/aqi/${year}/${month}/${currentDate}.json`;
          const response = await fetch(jsonUrl);
          if (!response.ok) throw new Error('JSON no encontrado');
          const data = await response.json();

          // Transformar a GeoJSON
          const geoJson = {
            type: 'FeatureCollection',
            features: data.map(item => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [item.lon, item.lat] // Mapbox usa [Lng, Lat]
              },
              properties: {
                aqi_value: item.aqi
              }
            }))
          };
          setAqiGeoJson(geoJson);
        } catch (error) {
          console.error("Error cargando AQI:", error);
          setAqiGeoJson(null);
        }
      };
      fetchAqi();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    
    let isCancelled = false;

    img.onload = () => {
      if (isCancelled) return;
      
      // Canvas para lectura de datos del Pop-up
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      canvasCtxRef.current = ctx;
      canvasSizeRef.current = { width: img.width, height: img.height };

      if (activeLayer === 'viento') {
        setWindPixels(ctx.getImageData(0, 0, img.width, img.height).data);
      } else {
        setWindPixels(null);
      }

      // Subir textura al WebGL layer
      if (customLayerRef.current && customLayerRef.current._gl) {
        const gl = customLayerRef.current._gl;
        gl.bindTexture(gl.TEXTURE_2D, customLayerRef.current._dataTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (mapInstanceRef.current) mapInstanceRef.current.triggerRepaint();
      } else {
        // Guardar para cuando el layer se monte
        if (customLayerRef.current) customLayerRef.current._pendingImg = img;
      }
    };
    
    return () => {
      isCancelled = true;
      img.onload = null;
      img.src = '';
      if (canvasCtxRef.current) {
        canvasCtxRef.current.clearRect(0, 0, canvasSizeRef.current.width, canvasSizeRef.current.height);
      }
    };
  }, [imageUrl, activeLayer]);

  // ─── Actualizar ref y paleta cuando cambia la capa ───
  useEffect(() => {
    activeLayerRef.current = activeLayer;

    if (!customLayerRef.current || !customLayerRef.current._gl) return;
    if (activeLayer === 'aqi') return; // AQI no usa paleta WebGL

    const gl = customLayerRef.current._gl;
    const stops = COLOR_RAMPS[activeLayer] || COLOR_RAMPS.visibilidad;
    const pixels = buildRampPixels(stops, activeLayer);
    gl.bindTexture(gl.TEXTURE_2D, customLayerRef.current._rampTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    if (mapInstanceRef.current) mapInstanceRef.current.triggerRepaint();
  }, [activeLayer]);

  // ─── Montar/desmontar el CustomLayer en Mapbox ───
  const handleMapLoad = useCallback((e) => {
    const rawMap = e.target;
    mapInstanceRef.current = rawMap;

    // Detectar firstSymbolId
    const layers = rawMap.getStyle().layers;
    const sym = layers.find(l => l.type === 'symbol' || l.id.includes('admin'));
    if (sym) setFirstSymbolId(sym.id);

    // Definir el CustomLayer (interfaz de Mapbox GL JS)
    const layerDef = {
      id: 'historico-custom-webgl',
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
        const initRamp = buildRampPixels(COLOR_RAMPS.visibilidad);
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
        if (activeLayerRef.current === 'aqi') return; // Bloquear WebGL para capa vectorial

        gl.useProgram(this._program);
        gl.uniformMatrix4fv(this._uMatrix, false, matrix);
        gl.uniform1f(this._uOpacity, 0.85);
        gl.uniform1f(this._uIsWind, activeLayerRef.current === 'viento' ? 1.0 : 0.0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._dataTex);
        gl.uniform1i(this._uData, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._rampTex);
        gl.uniform1i(this._uRamp, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(this._aPos);
        gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },

      onRemove(_map, gl) {
        if (this._program) gl.deleteProgram(this._program);
        if (this._buffer) gl.deleteBuffer(this._buffer);
        if (this._dataTex) gl.deleteTexture(this._dataTex);
        if (this._rampTex) gl.deleteTexture(this._rampTex);
      }
    };

    customLayerRef.current = layerDef;

    // Insertar debajo de las etiquetas
    const insertBefore = sym ? sym.id : undefined;
    rawMap.addLayer(layerDef, insertBefore);

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
      const map = mapInstanceRef.current;
      if (map && map.getStyle()) {
        try {
          if (map.getLayer('historico-custom-webgl')) map.removeLayer('historico-custom-webgl');
          if (map.getLayer('historico-coastline')) map.removeLayer('historico-coastline');
        } catch (_) { /* ignore */ }
      }
      customLayerRef.current = null;
      mapInstanceRef.current = null;
    };
  }, []);

  // ─── Pop-up: lectura de datos ───
  const handleMapClick = useCallback((evt) => {
    const { lng, lat } = evt.lngLat;

    if (activeLayer === 'aqi') {
      const map = evt.target;
      const features = map.queryRenderedFeatures(evt.point, { layers: ['aqi-circle-layer'] });
      if (features && features.length > 0) {
        const aqiVal = features[0].properties.aqi_value;
        setPopupInfo({ lng, lat, value: Math.round(aqiVal).toString(), unit: 'AQI', layer: activeLayer });
      }
      return;
    }

    if (lat > 85.051 || lat < -85.051) return;
    if (!canvasCtxRef.current) return;

    const { width, height } = canvasSizeRef.current;
    // Normalización idéntica a _geoToTexel de windMath.js
    const normLng = ((lng % 360) + 540) % 360 - 180;
    const normLat = Math.max(-90, Math.min(90, lat));
    // La imagen cruda viene con lat -90 en fila 0 (sur arriba)
    const pxX = Math.floor(((normLng + 180) / 360) * width);
    const pxY = Math.floor(((normLat + 90) / 180) * height);

    const pixelData = canvasCtxRef.current.getImageData(
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

    setPopupInfo({ lng, lat, value: displayValue, unit: displayUnit, layer: activeLayer });
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
    };
    const leg = legends[activeLayer];
    if (!leg) return null;
    return (
      <div style={{ marginTop: '20px' }}>
        <p style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: 'bold' }}>Leyenda</p>
        <div style={{ width: '100%', height: '12px', background: leg.gradient, borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          {leg.labels.map((lbl, i) => <span key={i}>{lbl}</span>)}
        </div>
      </div>
    );
  };

  const minTimeGlobal = new Date(MIN_DATE + 'T00:00:00Z').getTime();
  const maxTimeGlobal = new Date(MAX_DATE + 'T23:00:00Z').getTime();
  const totalHours = Math.floor((maxTimeGlobal - minTimeGlobal) / (1000 * 60 * 60));
  const currentHourOffset = Math.floor((selectedDate.getTime() - minTimeGlobal) / (1000 * 60 * 60));

  const formattedDateString = new Intl.DateTimeFormat("es-ES", { 
    weekday: 'long', 
    year: 'numeric',
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: 'UTC' 
  }).format(selectedDate);
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

  return (
    <div className="mapa-page-container" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}>
      <div className="map-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Map
          style={{ width: '100%', height: '100%' }}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onClick={handleMapClick}
          onLoad={handleMapLoad}
          mapStyle={mapStyle}
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
          attributionControl={false}
          projection="mercator"
        >
          <FullscreenControl position="top-right" />
          <NavigationControl position="top-right" />

          {activeLayer === 'viento' && (
            <HistoricalWindParticles 
              isActive={true} 
              windPixels={windPixels} 
            />
          )}

          {/* ─── CAPA VECTORIAL AQI ─── */}
          {activeLayer === 'aqi' && aqiGeoJson && (
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
                    '#7dd3ff', // < 10
                    10, '#00e400',
                    50, '#ffff00',
                    100, '#ff7e00',
                    150, '#ff0000',
                    200, '#8f3f97',
                    300, '#7e0023'
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
          {popupInfo && (
            <Popup
              longitude={popupInfo.lng}
              latitude={popupInfo.lat}
              closeButton={true}
              closeOnClick={false}
              onClose={() => setPopupInfo(null)}
              anchor="bottom"
              className="premium-weather-popup"
            >
              <div className="scalar-popup-content">
                <div className="scalar-popup-row" style={{ borderBottom: 'none' }}>
                  <span className="scalar-popup-label">{popupInfo.layer.toUpperCase()}</span>
                  <div className="scalar-popup-value-container">
                    <span className="scalar-popup-value">{popupInfo.value}</span>
                    <span className="scalar-popup-unit">{popupInfo.unit}</span>
                  </div>
                </div>
              </div>
            </Popup>
          )}
        </Map>

        {/* ─── PANELES DE CONTROL (Time Machine & Timeline) ─── */}
        
        {/* Selector Rápido Superior (Time Machine) -> Reubicado Abajo a la Derecha */}
        <div style={{ 
          position: 'absolute', bottom: '130px', right: 20, zIndex: 20, 
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)',
          padding: '1rem', borderRadius: '12px', color: 'white', 
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 600 }}>Modo Histórico</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
              Variable Atmosférica:
              <select
                value={activeLayer}
                onChange={e => setActiveLayer(e.target.value)}
                style={{ 
                  marginTop: '5px', padding: '6px 10px', 
                  background: 'rgba(255, 255, 255, 0.1)', color: 'white', 
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                  outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="visibilidad" style={{ color: 'black' }}>Visibilidad</option>
                <option value="viento" style={{ color: 'black' }}>Velocidad del Viento</option>
                <option value="rayos" style={{ color: 'black' }}>Densidad de Rayos</option>
                <option value="aqi" style={{ color: 'black' }}>Calidad del Aire (AQI)</option>
                <option value="uv" style={{ color: 'black' }}>Índice UV</option>
                <option value="humedad" style={{ color: 'black' }}>Humedad Relativa</option>
                <option value="isobaras" style={{ color: 'black' }}>Presión (Isobaras)</option>
                <option value="temperatura" style={{ color: 'black' }}>Temperatura</option>
                <option value="lluvia" style={{ color: 'black' }}>Precipitación (Lluvia)</option>
                <option value="nieve" style={{ color: 'black' }}>Acumulación de Nieve</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
              Fecha:
              <input
                type="date"
                min={MIN_DATE}
                max={MAX_DATE}
                value={selectedDate.toISOString().split('T')[0]}
                onChange={e => {
                  const newDate = new Date(e.target.value + 'T00:00:00Z');
                  newDate.setUTCHours(selectedDate.getUTCHours());
                  setSelectedDate(newDate);
                  setTimelineAnchorDate(newDate);
                }}
                style={{ 
                  marginTop: '5px', padding: '6px 10px', 
                  background: 'rgba(255, 255, 255, 0.1)', color: 'white', 
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                  outline: 'none', cursor: 'text'
                }}
              />
            </label>
          </div>
          {renderLegend()}
        </div>

        {/* Barra de Reproducción Inferior (Timeline UI) */}
        <div style={{
          position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(12px)',
          padding: '16px 24px', borderRadius: '16px', color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          display: 'flex', flexDirection: 'column', gap: '15px',
          width: '90%', maxWidth: '800px'
        }}>
          {/* Fila superior: Info de Fecha (Estilo Meteored) */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', letterSpacing: '0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            {finalFormattedText}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? 'rgba(255, 100, 100, 0.8)' : 'rgba(87, 160, 98, 0.9)',
                color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px',
                cursor: 'pointer', fontWeight: 600, fontSize: '15px', minWidth: '90px',
                transition: 'background 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              {isPlaying ? 'Pausa' : 'Play'}
            </button>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
              
              {/* Puntero Central de la Ruleta */}
              <div style={{
                position: 'absolute', left: '50%', top: '-5px', transform: 'translateX(-50%)',
                zIndex: 10, pointerEvents: 'none', color: '#ff4444', fontSize: '18px',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}>
                ▼
              </div>
              
              <div 
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                style={{ 
                  flex: 1, display: 'flex', overflowX: 'auto', 
                  gap: '6px', padding: '15px 0 5px 0',
                  /* Estilos para arrastre fluido */
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  /* Ocultar barra de scroll para estética limpia */
                  scrollbarWidth: 'none', msOverflowStyle: 'none'
                }} 
              >
                {timelineTicks.map((tickDate, idx) => {
                  const isSelected = tickDate.getTime() === selectedDate.getTime();
                  const hr = String(tickDate.getUTCHours()).padStart(2, '0');
                  const isMidnightOrNoon = hr === '00' || hr === '12';
                  const dayLabel = isMidnightOrNoon ? `${String(tickDate.getUTCDate()).padStart(2, '0')}/${String(tickDate.getUTCMonth() + 1).padStart(2, '0')}` : '';
                  
                  return (
                    <div 
                      key={idx}
                      id={`tick-${tickDate.getTime()}`}
                      onClick={() => setSelectedDate(tickDate)}
                      style={{
                        minWidth: '45px', padding: '6px 4px', borderRadius: '6px',
                        background: isSelected ? 'rgba(87, 160, 98, 0.9)' : 'rgba(255,255,255,0.1)',
                        border: isSelected ? '1px solid rgba(255,255,255,0.8)' : '1px solid transparent',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 0 10px rgba(87,160,98,0.5)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', minHeight: '14px', fontWeight: '600', pointerEvents: 'none' }}>
                        {dayLabel}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'white' : 'rgba(255,255,255,0.9)', pointerEvents: 'none' }}>
                        {hr}:00
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default MapasAtmosfericosHistorico;
