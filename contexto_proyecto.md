# Contexto y Estado Actual del Proyecto: Sistema de Datos Ambientales (EnviroSense)

Este documento describe en detalle la arquitectura, componentes, estado y funcionamiento del proyecto **EnviroSense**. Está diseñado para proporcionar contexto técnico completo sobre el sistema actual.

## 1. Estado actual del proyecto

El proyecto **EnviroSense** se encuentra en desarrollo activo como un sistema avanzado de monitoreo ambiental y simulación. Su arquitectura está consolidada en un entorno full-stack contenerizado, orientado a manejar series de tiempo de datos meteorológicos y de calidad ambiental.

Actualmente, el proyecto soporta:
- Visualización interactiva de mapas con mapas de calor y radares en tiempo real.
- Modos de simulación dinámica donde los usuarios pueden definir zonas geográficas en el mapa, inyectar valores (temperatura, calidad del aire, ruido, etc.) y visualizar cómo afectan los umbrales ambientales de forma síncrona vía WebSockets.
- Integración de datos de sensores IoT reales consumiendo APIs meteorológicas de terceros (Open-Meteo, WAQI).
- Generación de reportes históricos detallados con exportación a PDF y Excel.
- Un motor robusto de alertas ambientales y notificaciones multicanal (Telegram, WhatsApp, Email).

## 2. Lo que lleva el `docker-compose.yml`

El archivo `docker-compose.yml` define la orquestación de la infraestructura local mediante tres servicios principales:

- **`db` (Base de datos)**:
  - Imagen: `timescale/timescaledb:latest-pg16` (PostgreSQL 16 optimizado para series temporales).
  - Puertos: Expone el puerto `5433` (mapeado al 5432 del contenedor).
  - Volúmenes: `pgdata` (persistencia) y monta los scripts de inicialización (`esquema_envirosense.sql` y `01_sudamerica.sql`).
- **`backend` (API Node.js + Express)**:
  - Construido desde la carpeta `./Backend`. Expuesto en el puerto `3000`.
  - Depende del `healthcheck` de la base de datos para iniciar.
  - Volúmenes: Monta el código local para hot-reload y un volumen especial `whatsapp_session` para la autenticación persistente del bot de WhatsApp.
- **`frontend` (React + Vite)**:
  - Construido desde `./Frontend`. Expuesto en el puerto `5173`.
  - Depende del backend.
  - Volúmenes: Monta el código local para hot-reload inmediato durante el desarrollo.

## 3. Explicación de la base de datos y el esquema (`esquema_envirosense.sql`)

El esquema de base de datos está fuertemente normalizado (hasta la 4ta Forma Normal y BCNF) y está diseñado para escalabilidad a nivel nacional/internacional sin necesidad de alterar su estructura. Emplea las extensiones `timescaledb` (para optimización de grandes volúmenes de consultas cronológicas), `pgcrypto` y `btree_gin`.

Sus bloques funcionales principales son:

1. **Autenticación y RBAC (Bloque 1)**: Tablas de `roles`, `usuarios` y `tokens_usuario`. Los permisos se almacenan como `JSONB`.
2. **Geografía Jerárquica (Bloque 2)**: Soporta múltiples países, regiones (departamentos/estados) y localidades (con latitud, longitud y campos geojson para polígonos).
3. **Catálogo de Métricas, Unidades y Umbrales (Bloque 3)**:
   - Define métricas ambientales (Temperatura, AQI, ICA, Ruido, Humedad).
   - Conversiones lineales parametrizadas (`metrica_unidades`) para mostrar datos en distintas escalas (ej. °C a °F).
   - `umbrales`: Define niveles de severidad y colores hex que el frontend utiliza de forma reactiva.
4. **Fuentes de Datos (Bloque 4)**: Clasifica el origen del dato (`simulacion`, `openmeteo`, `waqi`, `sensor`).
5. **Lecturas en Serie de Tiempo (Bloque 5 - Núcleo)**: La tabla `lecturas` está convertida en una **hypertable** particionada por `tiempo` mediante TimescaleDB. Es altamente óptima para queries geográficas y temporales.
6. **Simulaciones (Bloque 6)**: Tabla `sesiones_simulacion` guarda las configuraciones en JSONB para auditoría y persistencia de eventos pasados.
7. **Alertas y Suscripciones (Bloque 7)**: Almacena eventos de peligro (`alertas`) y preferencias de usuarios para recibirlas (`suscripciones_alertas`).
8. **Reportes e IA (Bloques 8 y 9)**: Registra reportes generados y el historial de conversaciones multi-turno con el Agente IA, auditando el costo de tokens.

## 4. Infraestructura del proyecto

El sistema está desarrollado sobre una arquitectura moderna basada en micro-servicios (lógicamente segregados pero monolíticos en código fuente backend por ahora), optimizada para el tiempo real.

- **Frontend**: Single Page Application en ReactJS usando Vite. Utiliza Mapbox GL JS (`react-map-gl`) para un motor de mapas robusto acelerado por hardware (WebGL).
- **Backend**: Node.js v20+ con Express para endpoints RESTful HTTP, y `Socket.IO` acoplado al mismo servidor HTTP para la comunicación bidireccional de baja latencia requerida por la simulación.
- **Base de Datos**: PostgreSQL 16 con TimescaleDB.
- **Integraciones de Bot**: Servicio de escucha constante de `node-telegram-bot-api` (`telegram.listener.js`) corriendo en el contexto de Node, junto a crons periódicos.

## 5. Rutas y endpoints / APIs que consume

**Rutas internas del Backend:**
- `/api/auth`: Inicio y registro de sesión, tokens.
- `/api/historial`: Datos históricos de lecturas temporales.
- `/api/umbrales`: Proveedor dinámico de umbrales ambientales según métrica.
- `/api/geografia`: Consulta de países, regiones y localidades.
- `/api/radar`: Endpoints del scraper o generador de grid atmosférico de Bolivia.
- `/api/alertas`: Consulta y actualización (reconocimiento `PATCH`) de alertas.
- `/api/usuarios`, `/api/reportes`, `/api/simulacion`, `/api/notificaciones`, `/api/sensores`.

**APIs externas que consume:**
- **Mapbox API**: Geocoding (para buscar localidades mundiales en la barra de búsqueda del mapa) y Map Tiles (capas oscuras y claras vectoriales).
- **Open-Meteo API**: Extracción real-time de datos climáticos (temperatura, precipitación) e históricos en caso de que la BD local carezca de lecturas simuladas.
- **APIs de Calidad de Aire**: WAQI / OpenAQ están contempladas en el modelo como orígenes de lectura válidos (`fuentes_datos`).

## 6. Funcionamiento del Mapa y Simulación de Datos

**El Mapa Interactivo (`MapaMonitoreo.jsx`)**:
- Renderizado interactivo sobre Sudamérica. Se nutre de un geocoder de búsqueda universal.
- Dependiendo del estado, muestra diversas "capas":
  - **Capa Voronoi**: Un mapa de calor (Heatmap) orgánico para colorear áreas terrestres basado en las calidades ambientales calculadas.
  - **Capa Radar Meteorológico**: Componente visual que simula la reflexión y dispersión atmosférica sobre el grid configurado.
  - **Sensores IoT**: Marcadores interactivos que muestran los valores por punto al hacer click.

**El Motor de Simulación (`SimulacionContext` + `simulacion-zona.socket.js`)**:
- El usuario puede entrar en el **Modo Simulación**, el cual le permite dibujar puntos geográficos para delimitar un área poligonal calculada automáticamente usando la técnica de **Convex Hull** (envolvente convexa).
- Una vez trazada la zona, se configura qué métrica simular, los valores de inyección, unidades, y se arranca la simulación interactiva.
- El panel se sincroniza por **WebSockets** (Socket.IO). El Backend procesa cada "tick" de simulación, calcula si hay que incrementar / decrementar valores, evalúa en qué rango del umbral está cayendo y responde con el color hexadecimal apropiado. 
- En el frontend, el polígono (capa `SimulationZoneLayer`) actualiza dinámicamente su color de llenado basándose en la respuesta real del servidor.
- Además de reaccionar visualmente, estos "ticks" guardan lecturas persistentes en la hypertable de TimescaleDB.

## 7. Reportes, Notificaciones y Alertas

**Reportes (`Reportes.jsx`)**:
- Permite hacer análisis temporal o promedios usando filtros por ciudad y rango de fechas.
- Genera visualizaciones reactivas como gráficos de línea evolutiva y gráficos de barras (creados a mano de forma limpia usando SVG nativo en lugar de librerías pesadas externas).
- Dispone de exportación a un reporte procesado a través de los endpoints `/api/reportes/generar` que devuelve documentos Excel o PDF al cliente.

**Alertas (`Alertas.jsx`)**:
- Cuando una simulación inyecta datos por encima o por debajo de los umbrales "Informativos" definidos en BD, el sistema crea un registro en la tabla `alertas`.
- La UI permite al analista revisar estas alertas. Pueden filtrarse por severidad ("advertencia", "crítica", "emergencia").
- El flujo requiere una interacción humana para cerrar el incidente: el usuario debe hacer clic en **"Reconocer"**, lo cual llama al backend, marca `reconocida = true` y almacena qué usuario procesó la incidencia y a qué hora.

**Manejo de Notificaciones**:
- El backend está cableado a un sistema modular (`notificaciones.routes.js`, `telegram.listener.js`).
- Funciona de forma reactiva: a partir de las `suscripciones_alertas` de los usuarios, si un registro de alerta alcanza el umbral que el usuario parametrizó (Ej. "Quiero saber si el AQI en Cochabamba llega a nivel Crítico"), el servidor despacha un evento push.
- Se contemplan tres canales configurables por la tabla `configuracion_notificaciones`: Email, WhatsApp (vía contenedor secundario), y Telegram (mediante el polling bot integrado que corre en el backend `index.js`).
