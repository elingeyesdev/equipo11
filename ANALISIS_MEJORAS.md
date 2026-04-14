# Análisis de Mejoras – SistemaDatosAmbientales (EnviroSense)
**Fecha de análisis:** 13 de abril de 2026  
**Estado actual del sistema:** MVP Sprint 0 funcional

---

## Resumen del Estado Actual

| Componente | Estado |
|---|---|
| Autenticación (login/register) | Funcional |
| Mapa interactivo con marcadores | Funcional |
| Mapa de calor (heatmap Mapbox) | Funcional – básico |
| Simulación de datos en tiempo real | Funcional (9 ciudades bolivianas) |
| Panel de simulación con inyección manual | Funcional |
| Reportes | Placeholder (no implementado) |
| Panel de administración | Placeholder (no implementado) |
| Persistencia de datos ambientales | No implementada |
| Alertas en tiempo real | No implementadas |
| Agente IA | No implementado |

---

## Análisis por Funcionalidad Solicitada

---

### 1. Botón "Iniciar Simulación" que redirija al mapa y abra un modal

**Factibilidad: ALTA**

**Estado actual:** El botón de inicio existe en `/simulacion`, pero el usuario debe navegar manualmente al mapa. El mapa y la simulación están completamente desacoplados visualmente.

**Cómo implementarlo:**
1. En `PanelSimulacion.jsx`, al hacer clic en "Iniciar Simulación", se llama a `iniciar()` del contexto (ya existe) y luego `navigate('/mapa')` con React Router + un flag de estado en el contexto o en `location.state`.
2. En `MapaMonitoreo.jsx`, usar `useEffect` para detectar si se llegó con ese flag y disparar la apertura de un modal de estado de simulación.
3. El modal puede mostrar: métricas actuales, velocidad, tick count, ciudades activas.

**Dependencias técnicas necesarias:**
- `useNavigate()` de React Router (ya disponible).
- Un estado `openModalOnLoad` en el contexto `SimulacionContext`, o pasar `state` por el router (`navigate('/mapa', { state: { openModal: true } })`).
- Crear componente `<ModalSimulacion />` reutilizable.

**Esfuerzo estimado:** Bajo (1–2 sesiones de trabajo).

---

### 2. Botón "Envío de Datos Manual" que redirija al lugar y abra el modal

**Factibilidad: ALTA**

**Estado actual:** La inyección manual existe en `PanelSimulacion.jsx` como formulario independiente. No hay navegación al mapa ni visualización del dato modificado.

**Cómo implementarlo:**
1. Al inyectar datos en el formulario manual, tras emitir `simulacion:inyectar`, navegar a `/mapa` con `state: { ciudad: cityId, dato: valor, abrirModal: true }`.
2. En `MapaMonitoreo.jsx`, detectar ese estado y:
   a. Centrar el mapa en las coordenadas de la ciudad seleccionada (`flyTo` de Mapbox GL, ya disponible en el stack).
   b. Abrir el panel flotante de información de esa ciudad automáticamente (ya existe el panel flotante).
   c. Resaltar visualmente el marcador modificado (pulso animado con CSS).

**Dependencias técnicas:**
- `location.state` de React Router.
- `mapRef.current.flyTo({ center, zoom })` en Mapbox GL.
- Animación CSS `@keyframes pulse` para resaltar el marcador.

**Esfuerzo estimado:** Bajo-Medio (1–3 sesiones).

---

### 3. Mejora en la Pigmentación del Color en los Mapas de Calor

**Factibilidad: ALTA**

**Estado actual:** El heatmap de Mapbox usa colores genéricos no diferenciados por métrica. Se renderiza con una configuración básica de `heatmap-color`.

**Cómo implementarlo:**

Mapbox GL soporta expresiones de color interpoladas. Se puede definir una paleta diferente por métrica:

```js
// Ejemplo para AQI (verde → amarillo → rojo)
'heatmap-color': [
  'interpolate', ['linear'], ['heatmap-density'],
  0,   'rgba(0,0,0,0)',
  0.2, '#00e400',   // Bueno
  0.4, '#ffff00',   // Moderado
  0.6, '#ff7e00',   // No saludable sensibles
  0.8, '#ff0000',   // No saludable
  1.0, '#7e0023'    // Peligroso
]
```

Paletas recomendadas por métrica:
- **Temperatura:** azul (#0000ff) → blanco → rojo (#ff0000) – escala térmica clásica.
- **AQI:** verde → amarillo → naranja → rojo → morado → marrón (estándar EPA).
- **ICA (Agua):** azul oscuro (puro) → celeste → amarillo → marrón (contaminado).
- **Ruido:** verde → amarillo → naranja → rojo.
- **Humedad:** beige seco → celeste → azul oscuro.

**Esfuerzo estimado:** Bajo (configuración declarativa en Mapbox).

---

### 4. Definición de Umbrales para los Colores del Mapa de Calor

**Factibilidad: ALTA**

**Estado actual:** No existen umbrales definidos; los colores son lineales sin significado ambiental.

**Cómo implementarlo:**

1. Crear un archivo de configuración `Frontend/src/config/umbrales.js`:

```js
export const UMBRALES = {
  aqi: [
    { min: 0,   max: 50,  label: 'Bueno',                color: '#00e400' },
    { min: 51,  max: 100, label: 'Moderado',              color: '#ffff00' },
    { min: 101, max: 150, label: 'Dañino (sensibles)',    color: '#ff7e00' },
    { min: 151, max: 200, label: 'No saludable',          color: '#ff0000' },
    { min: 201, max: 300, label: 'Muy no saludable',      color: '#8f3f97' },
    { min: 301, max: 500, label: 'Peligroso',             color: '#7e0023' },
  ],
  temperatura: [ /* ... */ ],
  ica:         [ /* ... */ ],
  // etc.
}
```

2. Usar estos umbrales tanto en:
   - Las expresiones de color del heatmap de Mapbox.
   - Las tarjetas del panel de simulación.
   - La leyenda del mapa (ver punto 6).
   - Las alertas (ver punto 16).

**Estándar de referencia:** EPA (AQI), OMS (calidad del aire y agua), ICONTEC (ruido ambiental).

**Esfuerzo estimado:** Bajo-Medio.

---

### 5. Mapa Más Interactivo (Clickeable en Cualquier Lugar + Más Ideas)

**Factibilidad: ALTA (funciones base) / MEDIA (funciones avanzadas)**

**Estado actual:** Solo los marcadores son clickeables. El resto del mapa no responde.

**Cómo implementarlo:**

**A. Click en cualquier punto del mapa:**
- Registrar el evento `onClick` del componente `<Map>` de `react-map-gl`.
- Usar `queryRenderedFeatures` de Mapbox para detectar si hay datos del heatmap en ese punto.
- Mostrar un popup flotante con los valores interpolados de la zona más cercana.

**B. Popup con datos al hover (sin necesidad de click):**
- Usar el evento `onMouseMove` para mostrar un tooltip que siga el cursor con el valor del dato en esa zona.

**C. Clustering de marcadores:**
- Activar `cluster: true` en la fuente de datos Mapbox para agrupar ciudades al hacer zoom out y separarlos al hacer zoom in.

**D. Zoom a región al seleccionar desde el panel:**
- Al seleccionar una ciudad en la tabla del panel, el mapa hace `flyTo` a esa ubicación.

**E. Mini-gráfico histórico en el popup:**
- Al clickear un marcador, el popup muestra un sparkline (gráfico de línea pequeño) con la evolución del dato en las últimas N horas (requiere persistencia histórica en DB).

**F. Comparación de dos ciudades:**
- Seleccionar dos ciudades y mostrar un panel lateral comparativo.

**Esfuerzo estimado:** Medio-Alto (depende de cuántas sub-funciones se implementen).

---

### 6. Leyenda del Mapa (Valores → Colores)

**Factibilidad: MUY ALTA**

**Estado actual:** No existe leyenda.

**Cómo implementarlo:**

1. Crear componente `<LeyendaMapa />` como overlay absoluto en la esquina inferior derecha del mapa (usando `position: absolute` dentro del contenedor del mapa).
2. El componente lee `UMBRALES[metricaActual]` y renderiza una serie de rectángulos de color con etiquetas de rango.
3. Al cambiar la métrica activa en el toggle del heatmap, la leyenda se actualiza reactivamente.

**Ejemplo visual:**
```
[■] 0–50   Bueno
[■] 51–100 Moderado
[■] 101–150 Dañino (sensibles)
...
```

**Esfuerzo estimado:** Muy bajo (1 sesión).

---

### 7. Barra Interactiva de Timeline para Datos Históricos

**Factibilidad: MEDIA** (requiere persistencia de datos)

**Estado actual:** No hay persistencia histórica. Los datos solo existen en memoria durante la sesión.

**Cómo implementarlo:**

**Prerequisito:** Implementar almacenamiento de snapshots históricos en PostgreSQL (ver sección de Base de Datos).

1. Crear componente `<TimelineBar />` con un slider de tipo `input[type=range]` o una librería como `rc-slider`.
2. El slider va desde la fecha más antigua en DB hasta "ahora".
3. Al mover el slider, se hace una petición REST al backend: `GET /api/historico?desde=&hasta=&ciudad=`.
4. El backend devuelve los datos de ese rango y el mapa se actualiza con esos valores históricos.
5. Modo "reproducción": botón play que avanza el timeline automáticamente actualizando el mapa en tiempo real (como un video).

**Dependencias:**
- Persistencia en DB (tabla `lecturas_historicas`).
- Endpoint REST para consulta histórica.
- Librería de slider o componente custom.

**Esfuerzo estimado:** Alto (requiere backend + DB + UI).

---

### 8. Mayor Visualización en los Mapas de Calor

**Factibilidad: ALTA**

**Estado actual:** Heatmap básico Mapbox, sin diferenciación visual por métrica.

**Cómo implementarlo:**

1. **Aumentar radio e intensidad dinámicamente según zoom:**
   ```js
   'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 15, 10, 40]
   'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 1.5]
   ```

2. **Capa de contorno (isoline):** Superponer una capa de líneas de contorno sobre el heatmap para marcar los umbrales (requiere Mapbox GL Isochrone o calcular isocontornos manualmente con `d3-contour`).

3. **Opacidad dinámica por nivel de peligro:** Zonas críticas con mayor opacidad, zonas seguras más transparentes.

4. **Transición animada al cambiar métrica:** Usar la API de animación de capas de Mapbox para hacer fade-in/out suave al cambiar entre temperatura, AQI, etc.

5. **Modo 3D del heatmap:** Mapbox soporta extrusión 3D de polígonos. Representar departamentos como bloques 3D donde la altura = magnitud del dato.

**Esfuerzo estimado:** Medio.

---

### 9. Opción de Datos Variada para Medición Ambiental

**Factibilidad: ALTA**

**Estado actual:** Ya existen 5 métricas (temperatura, AQI, ICA, ruido, humedad). El selector existe pero es limitado.

**Cómo implementarlo:**

Agregar nuevas métricas al sistema de simulación y al heatmap:

| Métrica | Unidad | Descripción |
|---|---|---|
| Temperatura | °C / °F / K | Ya implementada |
| AQI | Índice | Ya implementado |
| ICA (Agua) | Índice | Ya implementado |
| Ruido | dB | Ya implementado |
| Humedad | % | Ya implementada |
| PM2.5 | µg/m³ | Partículas finas en el aire |
| PM10 | µg/m³ | Partículas gruesas |
| CO₂ | ppm | Dióxido de carbono |
| O₃ (Ozono) | ppb | Nivel de ozono troposférico |
| UV Index | 0–11+ | Índice ultravioleta |
| Presión atmosférica | hPa | Presión del aire |
| Velocidad del viento | km/h | Para partículas animadas |
| Precipitación | mm | Lluvia |

**Implementación:**
1. Extender `departamentos.data.js` con nuevas métricas y sus rangos.
2. Agregar las nuevas métricas al `simulacion.service.js`.
3. Agregar al selector de métricas en el mapa con íconos visuales.
4. Agregar `UMBRALES` para cada nueva métrica.

**Esfuerzo estimado:** Medio.

---

### 10. Buscador de Localidades (Global)

**Factibilidad: ALTA**

**Estado actual:** Solo existen las 9 ciudades bolivianas hardcodeadas. No hay buscador.

**Cómo implementarlo:**

**Opción A (Recomendada) – Mapbox Geocoding API:**
- Mapbox ya está integrado. Tiene una API de geocodificación gratuita hasta cierto límite.
- Componente `<Buscador />` con `<input>` que consulta `GET https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token=...`.
- Al seleccionar un resultado, el mapa hace `flyTo` a ese punto.
- Mostrar datos ambientales si el punto tiene datos; si no, mostrar "Sin datos para esta localidad".

**Opción B – OpenStreetMap Nominatim (gratuito, sin límites duros):**
- API REST pública de geocodificación.
- No requiere API key.
- Más lento que Mapbox pero completamente gratuito.

**Esfuerzo estimado:** Bajo (Mapbox ya integrado, solo agregar componente UI).

---

### 11. Variación de Mapas a Nivel Global

**Factibilidad: ALTA**

**Estado actual:** Solo mapa de Bolivia con 9 puntos.

**Cómo implementarlo:**

1. **Diferentes estilos de mapa base (Mapbox styles):**
   - `mapbox://styles/mapbox/satellite-streets-v12` – satelital con calles.
   - `mapbox://styles/mapbox/dark-v11` – oscuro para datos ambientales (recomendado para heatmaps).
   - `mapbox://styles/mapbox/light-v11` – claro y limpio.
   - `mapbox://styles/mapbox/outdoors-v12` – terreno y naturaleza.

2. **Selector de estilo en la UI:** Dropdown o botones de ícono en esquina del mapa.

3. **Estilo automático por métrica:**
   - Temperatura → mapa estilo "terreno" (outdoors).
   - AQI → mapa oscuro (dark) para mayor contraste con colores de calidad del aire.
   - Precipitación → satelital.

4. **Expansión global:** Remover la restricción de bounds actuales de Bolivia. Permitir navegación libre. Mostrar datos globales si se conectan APIs externas (ver sección de APIs).

**Esfuerzo estimado:** Bajo-Medio.

---

### 12. Implementación de Partículas Dependiendo del Dato

**Factibilidad: MEDIA**

**Estado actual:** No implementada.

**Cómo implementarlo:**

**Librería recomendada:** `tsparticles` (React: `@tsparticles/react`) o `react-particles`.

**Ideas de partículas por métrica:**

| Métrica | Efecto visual |
|---|---|
| Temperatura alta | Partículas rojas ascendentes (calor) |
| Temperatura baja | Copos de nieve cayendo |
| AQI alto | Partículas grises densas flotando (smog) |
| Humedad alta | Gotas de lluvia cayendo |
| Viento | Partículas horizontales con velocidad |
| Precipitación | Efecto lluvia/nieve configurable |
| UV alto | Rayos/destellos dorados |

**Implementación:**
1. Las partículas se renderizan como overlay sobre el mapa (canvas absoluto sobre el mapa GL).
2. La densidad, velocidad y color de partículas se actualizan en tiempo real según el valor actual de la métrica en la ciudad seleccionada.
3. Solo mostrar partículas en la ciudad/área seleccionada, no en todo el mapa (para performance).

**Nota de performance:** Las partículas en todo el viewport global pueden afectar el rendimiento. Limitar a la región visible o a puntos específicos.

**Esfuerzo estimado:** Medio.

---

### 13. Apartado de Reportes con Dashboard de Gráficos Estadísticos

**Factibilidad: ALTA** (con persistencia de datos)

**Estado actual:** Solo placeholder `/reportes`.

**Cómo implementarlo:**

**Librería recomendada:** `recharts` o `chart.js` (vía `react-chartjs-2`). Recharts es más fácil de usar con React.

**Componentes del dashboard:**

1. **Gráfico de línea temporal:** Evolución de una métrica en el tiempo para una o varias ciudades.
2. **Gráfico de barras comparativo:** Comparar todas las ciudades en una métrica específica en un momento dado.
3. **Gráfico radar/araña:** Perfil ambiental de una ciudad (todas las métricas en un chart).
4. **Mapa de calor de tabla (heatmap tabular):** Ciudad × Métrica con colores por umbral.
5. **Indicadores KPI (cards):** Valores máximos, mínimos, promedios, tendencias.
6. **Distribución (histograma):** Frecuencia de valores de una métrica en un período.

**Filtros:**
- Por ciudad / región.
- Por métrica.
- Por rango de fechas (requiere datos históricos).
- Por período: último día / semana / mes / año.

**Esfuerzo estimado:** Alto (requiere persistencia + diseño de UI completo).

---

### 14. Reportes de Datos Climáticos a Nivel Histórico

**Factibilidad: MEDIA-ALTA** (depende de datos históricos disponibles)

**Estado actual:** No hay histórico guardado.

**Cómo implementarlo:**

**Fuentes de datos históricos:**

1. **Datos propios simulados:** Guardar en DB todos los valores generados por la simulación con timestamp.
2. **APIs externas de clima histórico:** Ver sección de APIs recomendadas.

**Tipos de reportes:**
- Reporte por período: Descargar PDF/CSV de una ciudad en un rango de fechas.
- Reporte comparativo: Dos períodos (ej: enero 2025 vs enero 2026).
- Reporte de anomalías: Días donde se superaron umbrales críticos.
- Reporte de tendencias: Análisis de si los datos mejoran o empeoran en el tiempo.

**Generación de PDFs:**
- Librería `jspdf` + `html2canvas` para exportar dashboards como PDF directamente desde el frontend.
- O en backend con `puppeteer` para mayor calidad (renderiza el HTML completo).

**Esfuerzo estimado:** Alto.

---

### 15. Mejora en la Simulación (Nivel Departamental/Regional)

**Factibilidad: ALTA**

**Estado actual:** 9 ciudades puntuales hardcodeadas. Sin cobertura departamental/regional.

**Cómo implementarlo:**

1. **GeoJSON de departamentos:** Obtener los polígonos de los departamentos bolivianos (o de cualquier país) en formato GeoJSON. Fuente: `naturalearthdata.com`, `geojson.io`, o `gadm.org`.

2. **Agregar capa de polígonos en Mapbox:**
   ```js
   map.addSource('departamentos', { type: 'geojson', data: departamentosGeoJSON });
   map.addLayer({
     id: 'departamentos-fill',
     type: 'fill',
     source: 'departamentos',
     paint: {
       'fill-color': ['get', 'color'],  // color calculado por valor
       'fill-opacity': 0.6
     }
   });
   ```

3. **Simulación por área:** En lugar de un solo valor por ciudad, asignar un valor al polígono completo del departamento, con variaciones internas (gradiente).

4. **Interpolación espacial:** Usar algoritmos como IDW (Inverse Distance Weighting) para interpolar valores entre ciudades/estaciones y crear una superficie continua de datos.

5. **Expansión a otros países:** Con GeoJSON de niveles administrativos de cualquier país, el mismo sistema funciona globalmente.

**Esfuerzo estimado:** Medio-Alto.

---

### 16. Implementación de Alertas en Tiempo Real

**Factibilidad: ALTA**

**Estado actual:** No implementadas.

**Cómo implementarlo:**

**A. Alertas visuales en el mapa:**
- Cuando un valor supera un umbral crítico, el marcador de esa ciudad pulsa en rojo con animación CSS.
- Badge de notificación en el ícono del sidebar con contador de alertas activas.

**B. Panel de alertas:**
- Toast notifications (librería `react-hot-toast` o `react-toastify`) que aparecen en la esquina cuando se detecta un valor peligroso.
- Panel lateral de historial de alertas ordenadas por severidad.

**C. Sistema de umbrales:**
- Usando la configuración de `UMBRALES`, el backend detecta cuando un valor generado supera el umbral "peligroso" y emite un evento Socket.IO adicional: `simulacion:alerta`.
- El frontend escucha ese evento y dispara la notificación.

**D. Niveles de severidad:**
- Advertencia (amarillo): Valor cercano al límite.
- Crítico (rojo): Valor superó el umbral peligroso.
- Emergencia (parpadeante rojo): Valor extremo.

**E. Persistencia de alertas:**
- Guardar alertas en DB con timestamp, ciudad, métrica, valor registrado, y nivel de severidad.
- Consultarlas en el módulo de reportes.

**Esfuerzo estimado:** Medio.

---

### 17. Mejora en la UX

**Factibilidad: MUY ALTA**

**Mejoras recomendadas:**

1. **Onboarding / tutorial:** Primera vez que el usuario entra, mostrar un tour guiado con `react-joyride` o tooltips secuenciales explicando cada sección.

2. **Breadcrumbs y contexto:** El usuario siempre debe saber en qué sección está y cómo volvió ahí.

3. **Estado de carga (loading states):** Skeleton loaders mientras cargan los datos del mapa o los reportes.

4. **Mensajes de estado vacío:** Cuando no hay datos, mostrar ilustración + mensaje claro en lugar de un espacio vacío.

5. **Accesos directos:** Desde cualquier parte del sistema, poder iniciar la simulación sin ir al panel específico.

6. **Modo oscuro / claro:** Toggle de tema (el diseño actual parece oscuro; ofrecer ambas opciones).

7. **Responsividad:** Asegurar que el mapa y los paneles funcionen correctamente en tablets.

8. **Feedback inmediato:** Confirmar visualmente cuando el usuario inyecta datos manualmente (spinner → checkmark → animación en el mapa).

9. **Teclado accesible:** Shortcuts de teclado para acciones frecuentes (ej: `Ctrl+S` para detener simulación).

**Esfuerzo estimado:** Medio (cada mejora individual es pequeña, pero juntas suman).

---

### 18. Mejora en el Diseño (Dinámico, Manteniendo Colores Actuales)

**Factibilidad: ALTA**

**Recomendaciones de diseño:**

1. **Sistema de diseño consistente:** Definir en CSS variables (ya existe en `index.css`) los colores del sistema y asegurarse de que todos los componentes los usen.

2. **Glassmorphism para los paneles:** Efecto de vidrio esmerilado en los cards y paneles flotantes del mapa:
   ```css
   background: rgba(255, 255, 255, 0.05);
   backdrop-filter: blur(12px);
   border: 1px solid rgba(255, 255, 255, 0.1);
   ```

3. **Micro-animaciones:**
   - Números que "cuentan" al actualizarse (counter animation con `react-countup`).
   - Cards que hacen hover lift (box-shadow + transform al hover).
   - Sidebar que se expande/contrae con transición suave.

4. **Tipografía mejorada:** Usar `Inter` o `Geist` (fonts de Google) para un look más moderno.

5. **Indicadores de estado animados:** En lugar de un punto estático para "conectado/desconectado", usar un indicador con animación de pulso.

6. **Gradientes suaves en los backgrounds de cards:** En lugar de colores sólidos.

7. **Iconos consistentes:** Usar una librería de iconos como `lucide-react` para íconos más modernos y consistentes.

**Esfuerzo estimado:** Medio (principalmente CSS y pequeños ajustes de componentes).

---

### 19. Implementación de Agente IA

**Factibilidad: MEDIA-ALTA**

**Estado actual:** No implementado. El proyecto no usa ninguna API de IA actualmente.

**Cómo implementarlo:**

**A. Opción básica – Consultas en lenguaje natural:**
- Integrar la API de Claude (Anthropic) o OpenAI GPT como backend de un chat.
- El usuario escribe "¿Cuál fue la ciudad con peor calidad del aire la semana pasada?" y el agente consulta la DB y responde en lenguaje natural.
- El backend actúa como intermediario: recibe la pregunta, la envía a la IA con contexto de los datos, y devuelve la respuesta.

**B. Opción avanzada – Agente con herramientas:**
- Usando Claude API con `tool_use`, definir herramientas como:
  - `consultar_historico(ciudad, metrica, desde, hasta)`
  - `comparar_ciudades(ciudades[], metrica, fecha)`
  - `generar_reporte(tipo, ciudad, periodo)`
- El agente decide qué herramienta usar según la pregunta del usuario.

**C. Generación de reportes con IA:**
- El usuario pide "genera un reporte de contaminación del aire en Cochabamba del último mes".
- El agente consulta la DB, obtiene los datos, los analiza y genera un texto de reporte con insights automáticos.
- Opcionalmente, genera el PDF directamente.

**D. UI del Agente:**
- Sidebar o panel lateral con un chat flotante.
- Accesible desde cualquier sección del sistema.
- Historial de conversación persistido.

**Dependencias técnicas:**
- API key de Anthropic Claude o OpenAI.
- Endpoint backend `/api/agente` que maneje el contexto y las herramientas.
- Componente `<ChatAgente />` en frontend.

**Consideración de costos:** Las APIs de IA tienen costo por tokens. Implementar caché de respuestas frecuentes y límite de consultas por usuario.

**Esfuerzo estimado:** Alto (pero de alto impacto).

---

## Tabla de Factibilidad Resumida

| # | Mejora | Factibilidad | Prioridad Sugerida | Esfuerzo |
|---|---|---|---|---|
| 1 | Botón iniciar → mapa + modal | ALTA | Alta | Bajo |
| 2 | Botón envío manual → mapa + modal | ALTA | Alta | Bajo |
| 3 | Mejor pigmentación heatmap | ALTA | Alta | Bajo |
| 4 | Umbrales para colores | ALTA | Alta | Bajo |
| 5 | Mapa más interactivo | ALTA | Media | Medio |
| 6 | Leyenda del mapa | MUY ALTA | Alta | Muy bajo |
| 7 | Timeline histórico interactivo | MEDIA | Media | Alto |
| 8 | Mayor visualización heatmap | ALTA | Media | Medio |
| 9 | Más tipos de datos | ALTA | Media | Medio |
| 10 | Buscador global | ALTA | Alta | Bajo |
| 11 | Variación de mapas globales | ALTA | Media | Bajo |
| 12 | Partículas por dato | MEDIA | Baja | Medio |
| 13 | Reportes con dashboards | ALTA | Alta | Alto |
| 14 | Reportes históricos | MEDIA-ALTA | Media | Alto |
| 15 | Simulación departamental | ALTA | Media | Medio-Alto |
| 16 | Alertas en tiempo real | ALTA | Alta | Medio |
| 17 | Mejora UX | MUY ALTA | Alta | Medio |
| 18 | Mejora diseño | ALTA | Media | Medio |
| 19 | Agente IA | MEDIA-ALTA | Baja | Alto |

---

## Recomendación de Base de Datos

### Motor Recomendado: **PostgreSQL** (ya en uso) + **TimescaleDB** (extensión)

**¿Por qué TimescaleDB?**  
El sistema es esencialmente una base de datos de series de tiempo (lecturas de sensores con timestamps). TimescaleDB es una extensión de PostgreSQL que optimiza drásticamente las consultas sobre datos temporales (más rápido en órdenes de magnitud para `GROUP BY time`, `WHERE timestamp BETWEEN`, etc.) sin cambiar el motor de base de datos.

**Instalación:** Se agrega como extensión al contenedor PostgreSQL existente en Docker.

---

### Esquema de Base de Datos Recomendado

```sql
-- ============================================================
-- EXTENSIÓN DE SERIES DE TIEMPO
-- ============================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- USUARIOS Y AUTENTICACIÓN
-- ============================================================
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(20) DEFAULT 'visualizador', -- admin | analista | visualizador
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ============================================================
-- GEOGRAFÍA / LOCALIDADES
-- ============================================================
-- Soporte a nivel global: país → región administrativa → localidad
CREATE TABLE paises (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  codigo    CHAR(2) UNIQUE NOT NULL,  -- ISO 3166-1 alpha-2
  geojson   JSONB  -- polígono del país (opcional, para renderizar)
);

CREATE TABLE regiones (
  id         SERIAL PRIMARY KEY,
  pais_id    INT REFERENCES paises(id),
  nombre     VARCHAR(150) NOT NULL,
  nivel      VARCHAR(50),  -- 'departamento', 'estado', 'provincia', etc.
  geojson    JSONB         -- polígono de la región para renderizar en el mapa
);

CREATE TABLE localidades (
  id          SERIAL PRIMARY KEY,
  region_id   INT REFERENCES regiones(id),
  nombre      VARCHAR(150) NOT NULL,
  latitud     DECIMAL(10, 7) NOT NULL,
  longitud    DECIMAL(10, 7) NOT NULL,
  altitud_m   INT,          -- altitud sobre el nivel del mar
  activa      BOOLEAN DEFAULT TRUE
);

-- Índice espacial para búsqueda por coordenadas
CREATE INDEX idx_localidades_coords ON localidades(latitud, longitud);

-- ============================================================
-- MÉTRICAS / TIPOS DE DATOS AMBIENTALES
-- ============================================================
CREATE TABLE metricas (
  id          SERIAL PRIMARY KEY,
  clave       VARCHAR(50) UNIQUE NOT NULL, -- 'aqi', 'temperatura', 'pm25', etc.
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  unidad      VARCHAR(20) NOT NULL,        -- '°C', 'µg/m³', 'ppm', etc.
  activa      BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- UMBRALES POR MÉTRICA
-- ============================================================
CREATE TABLE umbrales (
  id          SERIAL PRIMARY KEY,
  metrica_id  INT REFERENCES metricas(id),
  nivel       INT NOT NULL,               -- 1=bueno, 2=moderado, ..., N=peligroso
  label       VARCHAR(50) NOT NULL,       -- 'Bueno', 'Moderado', 'Peligroso'
  valor_min   DECIMAL(10,3) NOT NULL,
  valor_max   DECIMAL(10,3) NOT NULL,
  color_hex   CHAR(7) NOT NULL            -- '#00e400'
);

-- ============================================================
-- LECTURAS / SERIE DE TIEMPO PRINCIPAL
-- ============================================================
CREATE TABLE lecturas (
  tiempo      TIMESTAMPTZ NOT NULL,
  localidad_id INT REFERENCES localidades(id),
  metrica_id  INT REFERENCES metricas(id),
  valor       DECIMAL(10,4) NOT NULL,
  fuente      VARCHAR(50) DEFAULT 'simulacion', -- 'simulacion' | 'sensor' | 'api_externa' | 'manual'
  PRIMARY KEY (tiempo, localidad_id, metrica_id)
);

-- Convertir a hypertable de TimescaleDB (particionada por tiempo automáticamente)
SELECT create_hypertable('lecturas', 'tiempo');

-- Índices para consultas frecuentes
CREATE INDEX idx_lecturas_localidad ON lecturas(localidad_id, tiempo DESC);
CREATE INDEX idx_lecturas_metrica ON lecturas(metrica_id, tiempo DESC);

-- ============================================================
-- ALERTAS
-- ============================================================
CREATE TABLE alertas (
  id            SERIAL PRIMARY KEY,
  tiempo        TIMESTAMPTZ DEFAULT NOW(),
  localidad_id  INT REFERENCES localidades(id),
  metrica_id    INT REFERENCES metricas(id),
  valor         DECIMAL(10,4) NOT NULL,
  umbral_id     INT REFERENCES umbrales(id),  -- umbral superado
  severidad     VARCHAR(20) NOT NULL,          -- 'advertencia' | 'critico' | 'emergencia'
  reconocida    BOOLEAN DEFAULT FALSE,
  reconocida_por INT REFERENCES usuarios(id),
  reconocida_en TIMESTAMPTZ
);

-- ============================================================
-- SESIONES DE SIMULACIÓN
-- ============================================================
CREATE TABLE sesiones_simulacion (
  id            SERIAL PRIMARY KEY,
  usuario_id    INT REFERENCES usuarios(id),
  inicio        TIMESTAMPTZ DEFAULT NOW(),
  fin           TIMESTAMPTZ,
  intervalo_ms  INT NOT NULL,
  configuracion JSONB,    -- parámetros usados en esa sesión
  total_ticks   INT DEFAULT 0
);

-- ============================================================
-- REPORTES GENERADOS
-- ============================================================
CREATE TABLE reportes (
  id            SERIAL PRIMARY KEY,
  usuario_id    INT REFERENCES usuarios(id),
  titulo        VARCHAR(255) NOT NULL,
  tipo          VARCHAR(50),       -- 'historico' | 'comparativo' | 'anomalias' | 'ia'
  parametros    JSONB NOT NULL,    -- filtros usados para generar el reporte
  contenido     TEXT,              -- texto/análisis generado (por IA o manual)
  url_pdf       VARCHAR(500),      -- ruta al PDF generado
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSACIONES CON EL AGENTE IA (futuro)
-- ============================================================
CREATE TABLE conversaciones_ia (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT REFERENCES usuarios(id),
  inicio      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mensajes_ia (
  id                 SERIAL PRIMARY KEY,
  conversacion_id    INT REFERENCES conversaciones_ia(id),
  rol                VARCHAR(20) NOT NULL, -- 'usuario' | 'asistente'
  contenido          TEXT NOT NULL,
  tiempo             TIMESTAMPTZ DEFAULT NOW(),
  tokens_usados      INT           -- para monitorear costos de API
);
```

### Justificación de Tablas y Relaciones

| Tabla | Por qué existe |
|---|---|
| `paises` + `regiones` + `localidades` | Jerarquía geográfica que permite escalar a cualquier país del mundo, no solo Bolivia. La relación polimórfica permite que la simulación opere a nivel ciudad o a nivel departamento. |
| `metricas` | Centraliza los tipos de datos ambientales. Agregar PM2.5, CO₂, UV, etc. es solo insertar un registro, sin cambiar código. |
| `umbrales` | Desacopla la lógica de colores y alertas de los componentes. Cambia el umbral en DB, cambia en toda la UI automáticamente. |
| `lecturas` (hypertable) | Es la tabla más crítica. TimescaleDB la particiona automáticamente por tiempo, haciendo las consultas `GROUP BY hora/día/mes` hasta 100x más rápidas. |
| `alertas` | Historial auditable de eventos críticos. La relación con `umbrales` permite saber exactamente qué límite se superó y cuándo fue reconocida. |
| `sesiones_simulacion` | Permite analizar cuándo y cómo se ejecutaron simulaciones, correlacionar datos simulados vs. reales, y reproducir sesiones pasadas. |
| `reportes` | Persiste los reportes generados para evitar recalcular. El campo `parametros JSONB` es flexible para cualquier tipo de reporte futuro. |
| `conversaciones_ia` + `mensajes_ia` | Historial de conversaciones con el agente IA. Permite contexto multi-turno y auditoría del uso de la API de IA. |

---

## APIs Externas Recomendadas

### Para Datos Ambientales en Tiempo Real y Históricos

| API | Datos que provee | Plan gratuito | Observaciones |
|---|---|---|---|
| **OpenWeatherMap** | Temperatura, humedad, presión, viento, UV, calidad del aire | 1,000 llamadas/día | Cubre todo el mundo. Ideal para complement data. |
| **IQAir (AirVisual)** | AQI, PM2.5, PM10, temperatura, humedad. Datos a nivel ciudad. | 10,000 llamadas/mes | El AQI de IQAir es de los más precisos y confiables. |
| **WAQI (World Air Quality Index)** | AQI en tiempo real de +12,000 estaciones globales | Gratuito con registro | API simple, muy buena cobertura en Latinoamérica. |
| **OpenAQ** | Datos de PM2.5, PM10, NO₂, O₃, CO, SO₂ de estaciones reales | Completamente gratuita | Open source, ideal para datos históricos reales de Bolivia. |
| **NASA POWER** | Temperatura, radiación solar, humedad, velocidad del viento (histórico desde 1981) | Completamente gratuita | Excelente para datos históricos y análisis de largo plazo. |
| **Open-Meteo** | Pronóstico y datos históricos de clima (temperatura, viento, lluvia, UV, PM, AQI) | Completamente gratuita | Sin límites de llamadas, sin API key. **Recomendación principal para el proyecto.** |
| **Copernicus (CAMS)** | Calidad del aire europeo y global, CO₂, ozono, aerosoles | Gratuita (requiere registro) | Datos científicos de alta calidad de la ESA. |
| **SENAMHI Bolivia** | Datos meteorológicos oficiales de Bolivia | Consultar directamente | Institución estatal boliviana. Datos reales nacionales. |

### Recomendación de Integración

**Para el proyecto actual se recomienda comenzar con:**

1. **Open-Meteo** – Para reemplazar/complementar la simulación de temperatura, humedad, viento y precipitación con datos reales. Sin costo, sin límites, sin API key.
   ```
   GET https://api.open-meteo.com/v1/forecast?latitude=-17.39&longitude=-66.16&current=temperature_2m,relative_humidity_2m,wind_speed_10m
   ```

2. **WAQI** – Para AQI real de ciudades bolivianas donde haya estaciones de monitoreo.
   ```
   GET https://api.waqi.info/feed/cochabamba/?token={API_KEY}
   ```

3. **OpenAQ** – Para datos históricos de PM2.5 y PM10 en Bolivia, que alimenten la sección de reportes históricos.

**Estrategia de integración:** Usar datos reales de APIs cuando estén disponibles para la ciudad solicitada, y caer en la simulación cuando no haya datos reales (fallback). Esto hace el sistema más realista sin perder la funcionalidad de simulación.

---

## Hoja de Ruta Sugerida (Sprints)

### Sprint 1 – Fundamentos (Alta prioridad, bajo esfuerzo)
- [ ] Persistencia de datos en DB (lecturas, alertas).
- [ ] Botones de navegación mapa+modal (#1, #2).
- [ ] Leyenda del mapa (#6).
- [ ] Umbrales de color y mejora de pigmentación (#3, #4).
- [ ] Buscador de localidades con Mapbox Geocoding (#10).

### Sprint 2 – Enriquecimiento del Mapa
- [ ] Más tipos de datos ambientales (#9).
- [ ] Variación de estilos de mapa (#11).
- [ ] Mayor interactividad del mapa (#5).
- [ ] Mejor visualización del heatmap (#8).
- [ ] Simulación a nivel departamental con GeoJSON (#15).
- [ ] Sistema de alertas en tiempo real (#16).

### Sprint 3 – Reportes y Análisis
- [ ] Dashboard de reportes con Recharts (#13).
- [ ] Timeline histórico interactivo (#7).
- [ ] Reportes históricos con datos de DB (#14).
- [ ] Exportación a PDF/CSV.
- [ ] Integración de APIs externas (Open-Meteo, WAQI) (#14 complemento).

### Sprint 4 – Experiencia y Avanzado
- [ ] Mejoras de UX y diseño (#17, #18).
- [ ] Partículas por métrica con tsparticles (#12).
- [ ] Agente IA con Claude API (#19).
- [ ] Mejoras de rendimiento y optimizaciones.

---

*Análisis generado el 13 de abril de 2026 para el proyecto EnviroSense - Sistema de Monitoreo de Datos Ambientales.*
