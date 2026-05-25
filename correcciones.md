# EnviroSense — Fix P0 Críticos (3 de 6 confirmados)

> **Fecha:** 2026-05-25
> **Estado tras auditoría:** De los 6 P0 reportados, **3 ya están resueltos** y **3 requieren fix inmediato**.
> **Tiempo estimado total:** ~20 min

---

## Resumen rápido

| # | Problema | Estado | Acción |
|---|----------|--------|--------|
| 1 | `fallbackData.js` no existe → build roto | 🔴 ACTIVO | Crear archivo |
| 2 | `logger.error()` usa `error` en vez de `err` | ✅ YA RESUELTO | Nada |
| 3 | Datos de prueba en `RainDataTexture.js` | ✅ YA RESUELTO | Nada |
| 4 | `temp_old_map.jsx` en el repo | ✅ YA RESUELTO | Nada |
| 5 | `resetCodes` sin TTL → memory leak | 🔴 ACTIVO | Agregar cleanup |
| 6 | SQL no parametrizado en `seedHistorial` | 🔴 ACTIVO | Parametrizar |

---

## FIX 1: Crear `Frontend/src/data/fallbackData.js` (~5 min)

### Contexto del problema

El archivo `Frontend/src/data/fallbackData.js` **no existe** ni el directorio `data/`. Sin embargo, **2 componentes lo importan**, lo que provoca que el **build falle completamente** (module resolution error).

**Archivos afectados:**
- `Frontend/src/pages/MapaMonitoreo/MapaMonitoreo.jsx` → línea 38: `import { FALLBACK_DATA } from '../../data/fallbackData'`
- `Frontend/src/hooks/useSensors.js` → línea 3: `import { FALLBACK_DATA } from '../data/fallbackData'`

**Uso en el código:**
- `MapaMonitoreo.jsx` línea 185: `const city = FALLBACK_DATA.find(c => c.id === cityIdToOpen)` → busca por `id`
- `useSensors.js` línea 25: fallback para marcadores, usa `city.longitude`, `city.latitude`, `city.name || city.ciudad`
- `useSensors.js` línea 51: mismo patrón de fallback

**Shape requerida por los consumidores:**
```
{
  id: string,
  name: string,        // opcional, también acepta `ciudad`
  latitude: number,
  longitude: number
}
```

### Instrucciones para OpenCode

```
Crea el archivo Frontend/src/data/fallbackData.js con el siguiente contenido exacto.

Este archivo debe exportar un array FALLBACK_DATA con las 9 ciudades de Bolivia
como datos estáticos de último recurso (fallback) cuando no hay datos de simulación
ni sensores IoT disponibles.

Los datos deben coincidir exactamente con las ciudades definidas en
Backend/Src/modules/simulacion/localidades.data.js (las 9 de Bolivia).

Shape de cada entrada: { id: string, name: string, latitude: number, longitude: number }

Archivo a crear: Frontend/src/data/fallbackData.js

Contenido:

/**
 * Datos de fallback estático para los marcadores del mapa.
 * Se usa como última opción cuando no hay datos de simulación ni sensores IoT.
 * Mantiene el shape: { id, name, latitude, longitude }.
 */
export const FALLBACK_DATA = [
  { id: 'lapaz',       name: 'La Paz',       latitude: -16.4897, longitude: -68.1193 },
  { id: 'cochabamba',  name: 'Cochabamba',    latitude: -17.3895, longitude: -66.1568 },
  { id: 'santacruz',   name: 'Santa Cruz',    latitude: -17.7833, longitude: -63.1812 },
  { id: 'oruro',       name: 'Oruro',         latitude: -17.9624, longitude: -67.1061 },
  { id: 'potosi',      name: 'Potosí',        latitude: -19.5836, longitude: -65.7531 },
  { id: 'sucre',       name: 'Sucre',         latitude: -19.0353, longitude: -65.2592 },
  { id: 'tarija',      name: 'Tarija',        latitude: -21.5355, longitude: -64.7296 },
  { id: 'trinidad',    name: 'Trinidad',      latitude: -14.8333, longitude: -64.9000 },
  { id: 'cobija',      name: 'Cobija',        latitude: -11.0267, longitude: -68.7692 },
]
```

### Verificación

Después de crear el archivo:
1. `cd Frontend && pnpm build` — debe compilar sin errores de module resolution
2. Verificar que `MapaMonitoreo.jsx:38` y `useSensors.js:3` resuelven el import correctamente

---

## FIX 2: Agregar TTL cleanup a `resetCodes` en `auth.service.js` (~5 min)

### Contexto del problema

En `Backend/Src/modules/auth/auth.service.js` línea 7, existe un `Map` en memoria:
```javascript
const resetCodes = new Map()// Registrar usuario
```

Cuando un usuario solicita recuperación de contraseña (líneas 60-64):
```javascript
const code = Math.floor(100000 + Math.random() * 900000).toString()
const expiresAt = Date.now() + 15 * 60 * 1000 // 15 minutos
resetCodes.set(email, { code, expiresAt })
```

El `expiresAt` se valida al leer (línea 77), pero **las entradas expiradas NUNCA se eliminan del Map**. Solo se borran si el usuario completa el reset (línea 92: `resetCodes.delete(email)`).

**Si un usuario pide código pero nunca lo usa**, la entrada queda huérfana para siempre. En producción con miles de usuarios, esto es un **memory leak** que crece sin bound.

### Instrucciones para OpenCode

```
En el archivo Backend/Src/modules/auth/auth.service.js, agrega un mecanismo de
limpieza periódica para el Map `resetCodes` que elimine entradas expiradas.

REGLAS:
1. NO cambies la lógica existente de forgotPassword ni resetPassword
2. NO uses setInterval (puede causar problemas en tests y multiple instances)
3. Usa un patrón "lazy cleanup" que se ejecute DENTRO de forgotPassword,
   ANTES de agregar el nuevo código
4. Esto asegura que se limpie al menos cada vez que alguien pide un código

Implementación exacta:

1. Agrega esta función justo ANTES de la línea 7 (antes del `const resetCodes`):

/**
 * Elimina entradas expiradas del Map resetCodes (lazy cleanup).
 * Se ejecuta cada vez que se genera un nuevo código.
 */
function purgeExpiredCodes () {
  const now = Date.now()
  for (const [key, record] of resetCodes) {
    if (record.expiresAt < now) resetCodes.delete(key)
  }
}

2. En la función forgotPassword (línea 54), agrega la llamada
   `purgeExpiredCodes()` como PRIMERA línea del try, es decir:

const forgotPassword = async ({ email }) => {
  const usuario = await findByEmail(email)
  purgeExpiredCodes()   // <-- AGREGAR ESTA LÍNEA
  if (!usuario) {
    throw new Error('No se encontró un usuario con ese correo')
  }
  // ... resto sin cambios
```

### Verificación

1. Verificar que `auth.service.js` compila sin errores: `node -e "require('./Backend/Src/modules/auth/auth.service')"`
2. Confirmar que `purgeExpiredCodes` aparece definida antes de `resetCodes`
3. Confirmar que se llama dentro de `forgotPassword` antes de cualquier `return` o `throw`

---

## FIX 3: Parametrizar SQL en `seedHistorial` (~10 min)

### Contexto del problema

En `Backend/Src/modules/historial/historial.controller.js`, la función `seedHistorial` (líneas 90-123) construye una query SQL concatenando strings directamente:

**Línea 108 (VULNERABLE):**
```javascript
inserts.push(`('${tiempo}', ${loc.id}, ${met.id}, ${(Math.random() * 100).toFixed(2)}, ${fuenteId})`)
```

**Líneas 113-116:**
```javascript
await db.query(`
  INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
  VALUES ${inserts.join(',')}
  ON CONFLICT DO NOTHING
`)
```

Aunque actualmente `localidades` y `metricas` vienen de la propia BD (no de input de usuario), esto viola el principio de **defense-in-depth**. Si el schema cambia (ej. IDs no numéricos) o alguien modifica la query base, queda abierto a SQL injection.

**El archivo correcto es `historial.controller.js`**, NO `simulacion.service.js` (ese archivo ya tiene SQL parametrizado correctamente).

### Instrucciones para OpenCode

```
En el archivo Backend/Src/modules/historial/historial.controller.js, reemplaza
la función seedHistorial (líneas 90-123) para usar SQL parametrizado en vez de
concatenación de strings.

REEMPLAZA el bloque completo de la función seedHistorial por:

  seedHistorial: async (req, res) => {
    try {
      const { rows: localidades } = await db.query('SELECT id, nombre FROM localidades')
      const { rows: metricas }    = await db.query('SELECT id, clave FROM metricas')
      const { rows: fuentes }     = await db.query("SELECT id FROM fuentes_datos WHERE clave = 'simulacion'")

      if (!fuentes.length) {
        return error(res, 'Fuente de datos "simulacion" no encontrada en la BD', 400)
      }

      const fuenteId = fuentes[0].id
      const now = Date.now()

      // Usar unnest() para SQL parametrizado (defense-in-depth)
      const tiempos = []
      const locIds = []
      const metIds = []
      const valores = []

      for (let i = 24; i >= 0; i--) {
        const tiempo = new Date(now - i * 60 * 60 * 1000).toISOString()
        for (const loc of localidades) {
          for (const met of metricas) {
            tiempos.push(tiempo)
            locIds.push(loc.id)
            metIds.push(met.id)
            valores.push(parseFloat((Math.random() * 100).toFixed(2)))
          }
        }
      }

      await db.query(
        `INSERT INTO lecturas (tiempo, localidad_id, metrica_id, valor, fuente_id)
         SELECT * FROM unnest(
           $1::timestamptz[], $2::int[], $3::int[], $4::numeric[], $5::int[]
         )
         ON CONFLICT DO NOTHING`,
        [tiempos, locIds, metIds, valores, Array(tiempos.length).fill(fuenteId)]
      )

      success(res, { mensaje: 'Datos de prueba inyectados (24 horas)', count: tiempos.length })
    } catch (err) {
      logger.error('[historial] seed error:', err)
      error(res, 'Error en seeding: ' + err.message, 500)
    }
  },

PUNTO CLAVE: La técnica usa unnest() con arrays tipados ($1::timestamptz[], etc.)
que es el patrón estándar en PostgreSQL para inserts masivos parametrizados.
Cada valor se pasa como parámetro del driver pg, nunca concatenado como string SQL.
```

### Verificación

1. Compilar: `node -e "require('./Backend/Src/modules/historial/historial.controller')"`
2. Revisar que NO haya template literals con `${...}` dentro de strings SQL (excepto los labels `$1`, `$2`, etc.)
3. Confirmar que la función `seedHistorial` usa `unnest(` y `$1`, `$2`, `$3`, `$4`, `$5`
4. Ejecutar el seed contra la BD de desarrollo y verificar que inserte correctamente

---

## Problemas ya resueltos (NO requieren acción)

### ✅ P0 #2: `logger.error()` usa `error` en vez de `err`

Tras revisar los 42+ `logger.error()` en todo el backend, **todas las llamadas usan correctamente la variable del bloque catch**:
- `catch (error)` → `logger.error(..., error)`
- `catch (err)` → `logger.error(..., err)`
- `catch (e)` → `logger.error(..., e)`

No hay mismatch. Este problema fue corregido previamente.

### ✅ P0 #3: Datos de prueba en `RainDataTexture.js`

El archivo `Frontend/src/layers/rainColor/RainDataTexture.js` (86 líneas) está limpio.
La línea 67 es simplemente el cierre `}` del loop `for`. El constructor inicializa con `Uint8Array` lleno de ceros y el método `update()` procesa dinámicamente los datos que recibe. No hay datos hardcodeados.

### ✅ P0 #4: `temp_old_map.jsx` en el repo

El archivo `temp_old_map.jsx` **no existe** en el codebase actual. Fue eliminado correctamente. Tampoco hay imports residuales que lo referencien.

---

## Checklist post-fix

- [ ] `Frontend/src/data/fallbackData.js` creado con las 9 ciudades de Bolivia
- [ ] `pnpm build` en Frontend compila sin errores
- [ ] `purgeExpiredCodes()` agregada a `auth.service.js`
- [ ] `seedHistorial` usa `unnest()` con parámetros `$1-$5`
- [ ] Commit: `fix: resolver 3 P0 críticos - fallbackData, TTL resetCodes, SQL parametrizado`
