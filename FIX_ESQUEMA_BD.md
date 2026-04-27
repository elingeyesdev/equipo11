# FIX_ESQUEMA_BD.md — Migración del esquema legacy al definitivo

> **Objetivo:** Dejar de usar `database/init.sql` + tabla `metricas_ambientales` y operar exclusivamente sobre `database/esquema_envirosense.sql` + hypertable `lecturas`. Este documento es **prescriptivo**: indica exactamente qué archivos tocar, en qué orden, y cómo verificarlo.

---

## Contexto rápido

Hoy el proyecto tiene **dos esquemas y dos persistencias paralelas**:

| Vía | Archivo | Tabla destino | Estado |
|-----|---------|---------------|--------|
| Legacy | `simulacion.socket.js:31-57` (Sequelize, `MetricaAmbiental`) | `metricas_ambientales` (wide) | ✅ funcionando, ❌ sin futuro |
| Nueva  | `simulacion.service.js:104-148` (`db.query(...)` pg-style)    | `lecturas` (hypertable)        | ⚠️ wired, **roto** por mismatches |

**Por qué migrar:** `metricas_ambientales` es "ancha" (una columna por métrica) — agregar PM2.5/CO₂/UV requiere `ALTER TABLE` y cambios en código. `lecturas` es "larga" (una fila por `(tiempo, localidad, métrica)`) sobre una hypertable de TimescaleDB — agregar una métrica es un `INSERT INTO metricas`.

**Inconsistencias que arrastra el código actual** (ya catalogadas en CLAUDE.md):
1. `umbrales.routes.js` une por `metrica_unidades.es_principal` → esa columna **no existe** en el esquema nuevo.
2. `geografia.routes.js` filtra por `paises.codigo_iso2` → en el esquema nuevo es `paises.codigo`.
3. `simulacion.service.js` usa claves de métrica en inglés (`temperature`, `waterQuality`, `noise`, `humidity`) → en el seed son `temperatura`, `ica`, `ruido`, `humedad`.
4. `db.js` exporta una instancia de **Sequelize** pero tres archivos lo usan estilo `pg` (`db.query(sql, $1)` + destructure `{ rows }`). Esa firma **no existe** en Sequelize → esos endpoints nunca devuelven datos.
5. Doble escritura por tick (service → `lecturas`, socket → `metricas_ambientales`).

---

## Plan de migración (en orden)

Cada paso debe **dejar el sistema arrancando** antes de pasar al siguiente. No saltar pasos: hay dependencias.

### Paso 0 — Snapshot

```bash
git checkout -b fix/migracion-esquema-definitivo
```

Confirmar que `docker-compose down -v` está disponible para resetear el volumen `pgdata` cuando toque (init scripts solo corren si la DB está vacía).

---

### Paso 1 — Unificar la capa DB en `pg.Pool`

**Por qué primero:** los pasos 2–5 escriben SQL crudo y necesitan que `db.query()` se comporte como `pg`, no Sequelize.

**Decisión:** abandonar Sequelize por completo (sólo lo usan `auth` y el historial legacy, ambos se reescriben). Mantener Sequelize introduce un wrapper innecesario.

**Archivo:** `Backend/Src/config/db.js` — reescribir:

```js
require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'sistema_ambiental',
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
})

pool.on('error', (err) => console.error('[pg] error en cliente idle:', err))

pool.connect()
  .then(c => { console.log('✅ Conectado a PostgreSQL (pg.Pool)'); c.release() })
  .catch(err => console.error('❌ Error de conexión a PostgreSQL:', err))

module.exports = pool
```

**Dependencias** (`Backend/package.json`):
- Asegurar `pg` instalado.
- Sequelize puede quedarse en `package.json` por ahora; se elimina al final cuando ya nadie lo importe.

**Verificación:** `npm run dev` levanta sin errores. Cualquier import de `sequelize` desde `db.js` reventará — es esperable, lo arreglamos en los pasos siguientes.

---

### Paso 2 — Reescribir `auth` con `pg`

**Archivos afectados:**
- `Backend/Src/modules/auth/auth.model.js` — borrar el modelo Sequelize, reemplazar por funciones que usen `pool.query`.
- `Backend/Src/modules/auth/auth.service.js` — adaptar imports/firma.
- `Backend/Src/modules/auth/auth.controller.js` — adaptar respuestas si hace falta.

El esquema nuevo tiene `usuarios` con FK a `roles` (no la del init.sql). Usar:
```sql
INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash)
VALUES ((SELECT id FROM roles WHERE clave = 'visualizador'), $1, $2, $3, $4)
RETURNING id, nombre, apellido, email, rol_id
```

**Verificación:** `POST /api/auth/registro` y `POST /api/auth/login` funcionan contra el nuevo esquema.

---

### Paso 3 — Apuntar Docker al esquema nuevo

**Archivo:** `docker-compose.yml`

```yaml
volumes:
  - ./database/esquema_envirosense.sql:/docker-entrypoint-initdb.d/01_schema.sql
  - ./database/seeds:/docker-entrypoint-initdb.d/seeds/
  - pgdata:/var/lib/postgresql/data
```

(Reemplazar el mount actual de `init.sql` por `esquema_envirosense.sql`.)

**Limpieza local:**
```bash
docker-compose down -v   # borra el volumen pgdata para que init scripts re-ejecuten
docker-compose up db
```

**Verificación dentro del contenedor:**
```bash
docker-compose exec db psql -U admin -d sistema_ambiental -c "\dx"          # debe listar timescaledb
docker-compose exec db psql -U admin -d sistema_ambiental -c "\dt"          # debe listar las ~25 tablas del nuevo esquema
docker-compose exec db psql -U admin -d sistema_ambiental -c "SELECT clave FROM metricas;"
# Debe devolver: temperatura, aqi, ica, ruido, humedad
```

Los seeds del esquema nuevo (Bolivia + métricas + umbrales AQI) ya vienen incluidos en `esquema_envirosense.sql`. Los seeds adicionales de umbrales (temperatura, ICA, ruido, humedad) los añade `database/seeds/02_umbrales.sql` documentado en `IMPLEMENTACION_DEFINITIVA_HEATMAP.md`.

---

### Paso 4 — Arreglar `umbrales.routes.js`

**Bug:** join contra `metrica_unidades.es_principal` (columna inexistente). En el esquema nuevo la unidad principal es `metricas.unidad_base_id`.

**Archivo:** `Backend/Src/modules/umbrales/umbrales.routes.js` — reemplazar el SQL por:

```js
const sql = metrica
  ? `SELECT u.nivel, u.label, u.valor_min, u.valor_max, u.color_hex, u.severidad,
            m.clave  AS metrica, m.nombre AS metrica_nombre,
            un.simbolo AS unidad
     FROM umbrales u
     JOIN metricas m  ON m.id = u.metrica_id
     JOIN unidades un ON un.id = m.unidad_base_id
     WHERE m.clave = $1
     ORDER BY u.nivel ASC`
  : `SELECT u.nivel, u.label, u.valor_min, u.valor_max, u.color_hex, u.severidad,
            m.clave  AS metrica, m.nombre AS metrica_nombre,
            un.simbolo AS unidad
     FROM umbrales u
     JOIN metricas m  ON m.id = u.metrica_id
     JOIN unidades un ON un.id = m.unidad_base_id
     ORDER BY m.clave, u.nivel ASC`
```

**Verificación:**
```bash
curl http://localhost:3000/api/umbrales/aqi
# Debe devolver 6 filas con nivel/label/color_hex/unidad="AQI"
```

---

### Paso 5 — Arreglar `geografia.routes.js`

**Bug:** filtra por `p.codigo_iso2` (columna inexistente). En el esquema nuevo es `p.codigo`.

**Archivo:** `Backend/Src/modules/geografia/geografia.routes.js` — buscar y reemplazar:

| Antes               | Después       |
|---------------------|---------------|
| `p.codigo_iso2 = $` | `p.codigo = $`|
| `p.codigo_iso2`     | `p.codigo`    |

**Verificación:**
```bash
curl "http://localhost:3000/api/geografia/localidades?pais_codigo=BO"
# Debe devolver 9 localidades bolivianas con lat/lng
```

---

### Paso 6 — Alinear claves de métrica en el simulador

**Decisión:** usar las claves del esquema (`temperatura`, `aqi`, `ica`, `ruido`, `humedad`) en TODO el sistema, no en inglés. Esto evita un mapping mental (y un bug latente) en frontend, backend y BD.

**Archivos afectados:**

#### a) `Backend/Src/modules/simulacion/simulacion.service.js`
Renombrar las claves del objeto `METRIC_CONFIG`, `METRIC_LIMITS`, y propagar al `data` que se emite por socket:

```js
const METRIC_CONFIG = {
  temperatura: { delta: 2 },
  aqi:         { delta: 12 },
  ica:         { delta: 6 },     // antes "waterQuality"
  ruido:       { delta: 5 },     // antes "noise"
  humedad:     { delta: 4 }      // antes "humidity"
}

const METRIC_LIMITS = {
  temperatura: { min: -40, max: 60 },
  aqi:         { min: 0,   max: 500 },
  ica:         { min: 0,   max: 100 },
  ruido:       { min: 0,   max: 140 },
  humedad:     { min: 0,   max: 100 },
}
```

#### b) `Backend/Src/modules/simulacion/departamentos.data.js`
Cambiar los keys del objeto `ranges` de cada departamento al mismo set en español.

#### c) Frontend que consume `data: { temperature, aqi, ... }`
- `Frontend/src/context/SimulacionContext.jsx`
- `Frontend/src/pages/MapaMonitoreo/**`
- `Frontend/src/pages/PanelSimulacion/**`

Buscar literales `'temperature'`, `'waterQuality'`, `'noise'`, `'humidity'` y reemplazar por los nuevos. (Recomendado: `Grep` por cada uno antes de editar.)

#### d) `historial.controller.js` y formularios de inyección manual
Si alguna UI envía un payload con keys en inglés, alinearlo.

**Verificación:**
- Iniciar simulación desde el frontend.
- En el contenedor de Postgres:
  ```sql
  SELECT m.clave, COUNT(*) FROM lecturas l JOIN metricas m ON m.id = l.metrica_id GROUP BY m.clave;
  ```
  Debe haber filas para las **5 claves** (no sólo `aqi`).

---

### Paso 7 — Eliminar la persistencia legacy del socket

**Archivo:** `Backend/Src/modules/simulacion/simulacion.socket.js`

Borrar:
- El `require('../../models/MetricaAmbiental')` mal ubicado dentro del handler (línea 31).
- Todo el bloque `try { ... await MetricaAmbiental.bulkCreate(recordsToInsert) ... }` del callback (líneas 37–57).

El callback queda así:
```js
const started = simulacionService.start(interval, (data) => {
  io.emit('simulacion:datos', data)
})
```

La persistencia ya vive en `simulacion.service.js#persistReadings` (que en el paso 6 quedó funcionando para las 5 métricas).

---

### Paso 8 — Migrar `historial` para leer desde `lecturas`

**Archivos:**
- `Backend/Src/modules/historial/historial.controller.js` — reescribir.
- Eliminar dependencia de `MetricaAmbiental` y `Op` de Sequelize.

**Nuevo `getHistorial`** — agrupa `lecturas` por timestamp (truncado a la resolución del tick) y devuelve la misma forma que el frontend ya consume:

```js
const db = require('../../config/db')

async function getHistorial(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT
        date_trunc('second', l.tiempo)  AS ts,
        loc.id                          AS localidad_id,
        loc.nombre                      AS ciudad,
        loc.latitud,
        loc.longitud,
        m.clave                         AS metrica,
        l.valor
      FROM lecturas l
      JOIN localidades loc ON loc.id = l.localidad_id
      JOIN metricas    m   ON m.id   = l.metrica_id
      ORDER BY ts ASC, loc.id
    `)

    // Agrupar { ts -> { timestamp, cities: [{ id, name, latitude, longitude, data: { metrica: valor } }] } }
    const groups = new Map()
    for (const r of rows) {
      const key = r.ts.toISOString()
      if (!groups.has(key)) groups.set(key, { timestamp: key, cities: new Map() })
      const g = groups.get(key)
      if (!g.cities.has(r.localidad_id)) {
        g.cities.set(r.localidad_id, {
          id: String(r.localidad_id),
          name: r.ciudad,
          latitude:  Number(r.latitud),
          longitude: Number(r.longitud),
          data: {}
        })
      }
      g.cities.get(r.localidad_id).data[r.metrica] = Number(r.valor)
    }

    const timeline = [...groups.values()].map(g => ({
      timestamp: g.timestamp,
      cities: [...g.cities.values()]
    }))

    res.json(timeline)
  } catch (err) {
    console.error('[historial] error:', err)
    res.status(500).json({ msg: 'Error obteniendo historial', error: err.message })
  }
}
```

**`POST /seed` y `DELETE /seed`** — adaptarlos a `lecturas` (insertar con `fuente_datos_id = (SELECT id FROM fuentes_datos WHERE clave='simulacion')` y `DELETE FROM lecturas WHERE fuente_id = ...`). Mantenerlos sólo si siguen siendo útiles para pruebas.

**Verificación:** `GET /api/historial` devuelve un array con la misma forma anterior, alimentado por `lecturas`.

---

### Paso 9 — Borrar lo legacy

Una vez los pasos 1–8 verificados:

- Borrar `Backend/Src/models/MetricaAmbiental.js`.
- Borrar `database/init.sql`.
- Borrar `Backend/Src/models/` si queda vacío.
- Quitar `sequelize` del `package.json` y `npm install` para regenerar el lock.
- Borrar de `simulacion.service.js` el comentario `// --- Integración con Base de Datos (Tarea 1.6) ---` y el log que dice "no guardará en BD hasta que exista esquema" — ya no aplica.

---

### Paso 10 — Smoke test end-to-end

1. `docker-compose down -v && docker-compose up`
2. `\dx` y `\dt` dentro del contenedor — confirmar TimescaleDB y las ~25 tablas.
3. `POST /api/auth/registro` → un usuario nuevo aparece en `usuarios` con `rol_id`.
4. `GET /api/umbrales/aqi` → 6 filas, `unidad="AQI"`.
5. `GET /api/geografia/localidades?pais_codigo=BO` → 9 filas con lat/lng.
6. Frontend: iniciar simulación → en BD `SELECT COUNT(*) FROM lecturas` crece monotónicamente; las 5 claves de métrica aparecen.
7. Frontend: heatmap renderiza con colores según `umbrales`; leyenda muestra labels (`Bueno`, `Moderado`, …).
8. Inyección manual de un valor extremo (AQI=450) → marcador correspondiente toma color `#7e0023`.
9. `GET /api/historial` → array con timeline alimentado por `lecturas`.

---

## Notas operativas

- **Resetear DB**: `docker-compose down -v` borra el volumen `pgdata`. Los scripts de `/docker-entrypoint-initdb.d/` solo corren cuando el directorio de datos está vacío, así que cualquier cambio en `esquema_envirosense.sql` requiere ese reset (en desarrollo).
- **Migraciones futuras**: cuando el esquema esté en producción, los cambios deben ir como migraciones explícitas (carpeta `database/migrations/NNNN_descripcion.sql`), no editando el archivo principal.
- **Compresión TimescaleDB**: cuando `lecturas` empiece a acumular volumen (≥ 30 días de datos), activar política de compresión:
  ```sql
  ALTER TABLE lecturas SET (timescaledb.compress, timescaledb.compress_segmentby = 'localidad_id, metrica_id');
  SELECT add_compression_policy('lecturas', INTERVAL '30 days');
  ```

---

## Checklist final

- [ ] Paso 1 — `db.js` migrado a `pg.Pool`
- [ ] Paso 2 — `auth` reescrito con `pg`
- [ ] Paso 3 — `docker-compose.yml` apunta a `esquema_envirosense.sql`, contenedor levanta limpio
- [ ] Paso 4 — `umbrales.routes.js` arreglado, `GET /api/umbrales/aqi` devuelve unidad
- [ ] Paso 5 — `geografia.routes.js` arreglado, filtro por `pais_codigo` funciona
- [ ] Paso 6 — claves de métrica unificadas (es) en backend y frontend
- [ ] Paso 7 — `simulacion.socket.js` ya no escribe a `metricas_ambientales`
- [ ] Paso 8 — `historial` lee desde `lecturas`
- [ ] Paso 9 — archivos/tablas legacy eliminados, `sequelize` removido de dependencias
- [ ] Paso 10 — smoke test E2E pasa
