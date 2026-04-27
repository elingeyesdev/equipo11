# Integración de Base de Datos y Mapas de Calor

Este plan detalla las tablas esenciales a implementar para reemplazar los datos hardcodeados en los mapas de calor, y aborda la capacidad del esquema para manejar datos históricos y reportes.

## Respuestas a tus consultas

### 1. ¿Qué tablas debemos tener ya implementadas y listas?
Para eliminar el uso de datos hardcodeados (`departamentos.data.js`, umbrales fijos, etc.) y alimentar los mapas de calor y la simulación, necesitamos instanciar y usar los siguientes "bloques" de tu esquema:

**Bloque Geográfico (Los puntos en el mapa):**
- `paises`, `regiones`, `localidades`: Proveen las coordenadas geográficas (lat/lng) e información administrativa de las ciudades y departamentos para renderizar en el mapa.

**Bloque de Catálogos de Métricas (Los colores y escalas):**
- `categorias_metricas`, `unidades`, `metricas`: Definen qué estamos midiendo exactamente (Ej. AQI, Temperatura).
- `metrica_unidades`: Factores de conversión.
- `umbrales`: **Crucial para los mapas de calor.** Aquí se guardan los colores hexadecimales y los límites oficiales (EPA, OMS) que determinarán cómo y de qué color se pinta cada métrica en el mapa.

**Bloque de Serie de Tiempo (Los datos vivos):**
- `fuentes_datos`: Para catalogar si la lectura vino del motor de simulación, de inyección manual o futura API.
- `lecturas`: La tabla principal. Aquí el backend irá haciendo `INSERT` continuo, y el frontend consultará para dibujar y actualizar el heatmap en tiempo real y el histórico.

### 2. ¿Aguanta la base de datos el historial y los reportes masivos?
**Absolutamente SÍ.** La genialidad de tu esquema propuesto (`esquema_envirosense.sql`) es el uso de la extensión **TimescaleDB** dentro de PostgreSQL.
- Al ejecutar `SELECT create_hypertable('lecturas', 'tiempo')`, la tabla `lecturas` deja de ser una tabla normal y se convierte en una base de datos de series de tiempo particionada.
- **Rendimiento:** Puedes ingestar millones de registros (ticks de simulación o lecturas cada segundo). TimescaleDB indexa y particiona el tiempo nativamente, haciendo que consultas como "Promedio de la última semana por hora" se resuelvan en milisegundos mediante funciones como `time_bucket`.
- **Reportes:** La tabla `reportes` está pensada para guardar los parámetros de búsqueda en JSONB y los resultados de reportes ya analizados, por lo que no colapsarás la base de datos recalculando un reporte histórico pesado cada vez que se abre la página.

---

## User Review Required

> [!IMPORTANT]
> Necesitamos confirmar si la infraestructura de la Base de Datos ya soporta **TimescaleDB**. 
> Si usamos Docker, debemos asegurar que el `docker-compose.yml` use la imagen `timescale/timescaledb:latest-pg16` en lugar del `postgres` común, para que el `create_hypertable` no arroje error.

## Proposed Changes

### 1. Preparación de la Base de Datos
Aplicación del esquema oficial en la BD.

#### [NEW] Scripts de Inicialización BD
Asegurarnos de que `database/esquema_envirosense.sql` se ejecute al levantar el contenedor y que todas las tablas base (`paises`, `regiones`, `umbrales`, `metricas`) estén llenas con los inserts predeterminados que ya tienes en ese archivo.

---

### 2. Backend (Migración de datos hardcodeados a BD)

#### [NEW] `Backend/src/modules/umbrales/umbrales.routes.js`
#### [NEW] `Backend/src/modules/umbrales/umbrales.controller.js`
Crear un endpoint `GET /api/umbrales/:metrica` (según se propone en `PROPUESTA_MAPAS_DE_CALOR.md`). Esto entregará al frontend los rangos y colores directamente desde la tabla `umbrales`.

#### [NEW] `Backend/src/modules/geografia/geografia.routes.js`
Crear endpoint para obtener la lista de localidades y coordenadas geográficas, abandonando los arrays locales.

#### [MODIFY] `Backend/src/modules/simulacion/simulacion.service.js`
Refactorizar el motor de simulación para que, en cada tick, construya los datos usando la información de la base de datos e inserte las lecturas generadas en la tabla `lecturas` (hypertable).

---

### 3. Frontend (Consumo para Mapas de Calor Dinámicos)

#### [NEW] `Frontend/src/hooks/useUmbrales.js`
Crear un hook especializado que haga fetch a `/api/umbrales` y almacene en caché las paletas de color y rangos.

#### [MODIFY] `Frontend/src/pages/MapaMonitoreo/MapaMonitoreo.jsx`
- Reemplazar el arreglo estático `'heatmap-color'` por una función dinámica que reciba la respuesta de `useUmbrales` y ensamble los `[valor_min, color_hex]` usando las API de Mapbox.
- Dejar de importar `ciudades` locales y alimentar los source de Mapbox desde el backend.

## Verification Plan

### Automated Tests / Comprobaciones
1. **Validar extensión DB:** Entrar al contenedor de Postgres y correr `\dx` para verificar que `timescaledb` esté listado.
2. **Endpoint Umbrales:** Hacer una petición GET a `/api/umbrales/aqi` y corroborar que devuelva el array con los 6 niveles de severidad EPA, sus colores correspondientes y rangos.
3. **Simulación:** Iniciar la simulación en el frontend y corroborar mediante loggeo que la base de datos (`tabla lecturas`) esté sumando registros por segundo.
4. **Visualización:** Alternar entre Temperatura, AQI, y Ruido en el mapa para confirmar que los colores del mapa cambian de acuerdo a los umbrales recibidos por la base de datos, y ya no de forma estática.
