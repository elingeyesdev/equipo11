# Migración Esquema BD — EnviroSense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar de `init.sql` + Sequelize + tabla `metricas_ambientales` al esquema `esquema_envirosense.sql` + `pg.Pool` + hypertable `lecturas`, alineando claves de métricas en backend y frontend.

**Architecture:** Reemplazar la capa Sequelize por `pg.Pool` en `db.js`; reescribir todos los módulos que usaban Sequelize o tenían SQL incorrecto para el nuevo esquema; renombrar claves de métricas de inglés a español en todo el stack.

**Tech Stack:** Node.js 20 + Express 5 + pg 8 + Socket.IO + React 19 + Vite + PostgreSQL 16 + TimescaleDB

---

### Task 1: Migrar db.js a pg.Pool

**Files:**
- Modify: `Backend/Src/config/db.js`

- [ ] Reescribir el archivo completo:

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

---

### Task 2: Reescribir auth.model.js con pg

**Files:**
- Modify: `Backend/Src/modules/auth/auth.model.js`

- [ ] Reescribir para usar pool.query() con el nuevo esquema (requiere rol_id):

```js
const db = require('../../config/db')

const findByEmail = async (email) => {
  const { rows } = await db.query(
    'SELECT * FROM usuarios WHERE email = $1',
    [email]
  )
  return rows[0] || null
}

const createUser = async ({ nombre, apellido, email, password_hash }) => {
  const { rows } = await db.query(
    `INSERT INTO usuarios (rol_id, nombre, apellido, email, password_hash)
     VALUES ((SELECT id FROM roles WHERE clave = 'visualizador'), $1, $2, $3, $4)
     RETURNING id, nombre, apellido, email, rol_id`,
    [nombre, apellido, email, password_hash]
  )
  return rows[0]
}

module.exports = { findByEmail, createUser }
```

---

### Task 3: Apuntar Docker al esquema nuevo

**Files:**
- Modify: `docker-compose.yml`

- [ ] Cambiar el mount de init.sql a esquema_envirosense.sql

---

### Task 4: Arreglar umbrales.routes.js

**Files:**
- Modify: `Backend/Src/modules/umbrales/umbrales.routes.js`

- [ ] Reemplazar los JOINs con metrica_unidades.es_principal por metricas.unidad_base_id

---

### Task 5: Arreglar geografia.routes.js

**Files:**
- Modify: `Backend/Src/modules/geografia/geografia.routes.js`

- [ ] Reemplazar `p.codigo_iso2` por `p.codigo` en condiciones y SELECT

---

### Task 6: Renombrar claves de métricas en backend

**Files:**
- Modify: `Backend/Src/modules/simulacion/simulacion.service.js`
- Modify: `Backend/Src/modules/simulacion/departamentos.data.js`

- [ ] Renombrar claves: temperature→temperatura, waterQuality→ica, noise→ruido, humidity→humedad

---

### Task 7: Eliminar persistencia legacy del socket

**Files:**
- Modify: `Backend/Src/modules/simulacion/simulacion.socket.js`

- [ ] Eliminar require MetricaAmbiental y el bloque bulkCreate

---

### Task 8: Reescribir historial.controller.js

**Files:**
- Modify: `Backend/Src/modules/historial/historial.controller.js`

- [ ] Reescribir para leer desde lecturas con pg.Pool

---

### Task 9: Renombrar claves de métricas en frontend

**Files:**
- Modify: `Frontend/src/utils/unidades.js`
- Modify: `Frontend/src/pages/MapaMonitoreo/MapaMonitoreo.jsx`
- Modify: `Frontend/src/pages/PanelSimulacion/PanelSimulacion.jsx`
- Modify: `Frontend/src/pages/MapaMonitoreo/components/HeatmapLegend.jsx`

- [ ] Renombrar temperature→temperatura, waterQuality→ica, noise→ruido, humidity→humedad en todos los archivos frontend

---

### Task 10: Eliminar archivos legacy

**Files:**
- Delete: `Backend/Src/models/MetricaAmbiental.js`
- Delete: `database/init.sql`

- [ ] Borrar ambos archivos

---
