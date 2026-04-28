-- =============================================================================
-- EnviroSense — Esquema de base de datos normalizado y escalable
-- Versión: 1.0    |    Fecha: 2026-04-19    |    Motor: PostgreSQL 16 + TimescaleDB
-- =============================================================================
--
-- PROPÓSITO DE ESTE ARCHIVO
-- -----------------------------------------------------------------------------
-- Este script reemplaza al esquema preliminar descrito en ANALISIS_MEJORAS.md
-- (líneas 631-789) y al init.sql mínimo actual. Integra TODO lo que el sistema
-- EnviroSense necesita para soportar sus funcionalidades presentes y las
-- planeadas en la hoja de ruta (Sprints 1-4):
--
--   • Autenticación con control de roles (RBAC real).
--   • Jerarquía geográfica multi-país (país → región → localidad).
--   • Métricas ambientales categorizadas y con soporte multi-unidad.
--   • Umbrales parametrizables por métrica (colores, niveles, rangos).
--   • Lecturas en serie de tiempo (hypertable TimescaleDB) con catálogo
--     de fuentes (simulación, APIs externas reales, entrada manual, sensor).
--   • Sesiones de simulación auditables.
--   • Sistema de alertas con suscripciones por usuario.
--   • Reportes persistidos con parámetros reutilizables.
--   • Historial de conversaciones con el agente IA (para contexto multi-turno
--     y monitoreo de costos de la API).
--   • Preferencias de usuario (tema, unidad preferida por métrica) y favoritos.
--
-- JUSTIFICACIÓN DEL MOTOR
-- -----------------------------------------------------------------------------
-- PostgreSQL 16 + TimescaleDB. PostgreSQL aporta integridad referencial, JSONB,
-- tipos geoespaciales y constraints declarativos (CHECK, UNIQUE compuesta);
-- TimescaleDB extiende la tabla `lecturas` como hypertable particionada por
-- tiempo, lo que hace que consultas de rango ("temperatura de Cochabamba la
-- última semana agrupada por hora") sean hasta 100x más rápidas que sobre una
-- tabla plana, sin cambiar el motor ni el lenguaje SQL.
--
-- =============================================================================
-- ANÁLISIS DE NORMALIZACIÓN
-- =============================================================================
--
-- El esquema cumple hasta 4FN (Cuarta Forma Normal) — y BCNF en todas las
-- relaciones donde los atributos naturales tienen candidatos únicos.
--
-- 1FN (Primera Forma Normal)
--   • Todos los atributos son atómicos: no hay listas, arrays ni grupos
--     repetitivos dentro de una celda.
--   • Uso de JSONB limitado a datos que son semánticamente una unidad:
--       - `paises.geojson` / `regiones.geojson`: un polígono GIS entero.
--       - `reportes.parametros`: snapshot inmutable de filtros aplicados.
--       - `sesiones_simulacion.configuracion`: snapshot de configuración.
--       - `roles.permisos`: catálogo flexible de permisos por rol.
--     Estos NO son atributos susceptibles de consulta relacional individual;
--     almacenarlos en tablas hijas agregaría tablas con decenas de columnas
--     sin beneficio consultivo real.
--   • Los valores enumerados (rol, severidad, tipo de reporte) NO se modelan
--     como VARCHAR libre: se validan con CHECK o con FK a tablas catálogo.
--
-- 2FN (Segunda Forma Normal)
--   • Todas las tablas con PK simple cumplen 2FN trivialmente.
--   • `lecturas` tiene PK compuesta (tiempo, localidad_id, metrica_id); los
--     atributos no-clave (`valor`, `fuente_id`) dependen funcionalmente del
--     conjunto completo de la PK, nunca de un subconjunto.
--   • `metrica_unidades` y las tablas puente (`suscripciones_alertas`,
--     `favoritos_usuario`) usan PKs compuestas y sus atributos no-clave
--     dependen de ambas columnas.
--
-- 3FN (Tercera Forma Normal)
--   • No existen dependencias transitivas: por ejemplo, `localidades` NO
--     almacena el nombre del país — se obtiene vía JOIN `regiones → paises`.
--   • `usuarios` NO almacena el nombre del rol — lo obtiene vía `roles`.
--   • `lecturas` NO almacena la unidad de la métrica — la obtiene vía
--     `metricas.unidad_base_id → unidades`.
--
-- BCNF (Forma Normal de Boyce-Codd)
--   • Cada determinante es una clave candidata.
--   • `umbrales`: las claves candidatas son `id`, `(metrica_id, nivel)` y
--     `(metrica_id, label)`. Ambos pares tienen UNIQUE declarado, por lo
--     que todos los determinantes son claves candidatas → BCNF.
--   • `usuarios.email` es UNIQUE (clave candidata además del `id`).
--   • `metricas.clave`, `paises.codigo`, `fuentes_datos.clave`,
--     `unidades.simbolo` son todas UNIQUE (claves candidatas naturales).
--
-- 4FN (Cuarta Forma Normal)
--   • No existen dependencias multivaluadas no triviales.
--   • Relaciones muchos-a-muchos SIEMPRE se modelan con tabla puente:
--       - Usuarios ↔ Localidades favoritas → `favoritos_usuario`.
--       - Usuarios ↔ Alertas suscritas   → `suscripciones_alertas`.
--       - Métricas ↔ Unidades alternativas → `metrica_unidades`.
--       - Usuarios ↔ Preferencias por métrica → `preferencias_usuario_metrica`.
--     Cada tabla puente guarda SOLO los atributos que dependen del par completo
--     (ej: factor de conversión) — ningún atributo depende de sólo un lado.
--
-- 5FN / PJNF
--   • No se detectaron dependencias de join que justifiquen descomposición
--     adicional; las tablas puente actuales son binarias y no reconstruibles
--     desde proyecciones más pequeñas.
--
-- =============================================================================
-- EXTENSIONES
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid() para tokens
CREATE EXTENSION IF NOT EXISTS btree_gin;     -- índices GIN sobre JSONB


-- =============================================================================
-- BLOQUE 1 — AUTENTICACIÓN Y CONTROL DE ACCESO (RBAC)
-- =============================================================================
--
-- Diseño: `roles` separado de `usuarios` para permitir añadir/modificar roles
-- sin tocar la tabla de usuarios. El campo `permisos JSONB` evita crear una
-- tabla de permisos explícita en esta fase (MVP) pero deja la puerta abierta
-- a migrar a un modelo `permisos` + `roles_permisos` sin romper contratos.
--
-- Normalización: 3FN. `usuarios` no almacena atributos del rol (nombre,
-- permisos) — sólo la FK. Al renombrar un rol, no hay actualización masiva.

CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  clave       VARCHAR(30)  UNIQUE NOT NULL,   -- 'admin', 'analista', 'visualizador'
  nombre      VARCHAR(60)  NOT NULL,
  descripcion TEXT,
  permisos    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO roles (clave, nombre, descripcion, permisos) VALUES
  ('admin',         'Administrador', 'Acceso total al sistema',
     '{"simulacion":["iniciar","detener","inyectar"],"usuarios":["crear","modificar","eliminar"],"reportes":["crear","ver"],"alertas":["gestionar"]}'::jsonb),
  ('analista',      'Analista',      'Ejecuta simulaciones, genera reportes y gestiona alertas',
     '{"simulacion":["iniciar","detener","inyectar"],"reportes":["crear","ver"],"alertas":["gestionar"]}'::jsonb),
  ('visualizador',  'Visualizador',  'Sólo lectura del mapa y reportes',
     '{"reportes":["ver"]}'::jsonb);

CREATE TABLE usuarios (
  id              SERIAL       PRIMARY KEY,
  rol_id          INT          NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100) NOT NULL,
  email           VARCHAR(150) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  email_verificado BOOLEAN     NOT NULL DEFAULT FALSE,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ultimo_login    TIMESTAMPTZ,
  CONSTRAINT email_formato CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_usuarios_rol ON usuarios(rol_id);

-- Tokens para verificación de email y reset de contraseña (flujos auth típicos).
-- Tabla separada para poder purgar tokens expirados sin tocar `usuarios`.
CREATE TABLE tokens_usuario (
  id          SERIAL       PRIMARY KEY,
  usuario_id  INT          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token       UUID         NOT NULL DEFAULT gen_random_uuid(),
  tipo        VARCHAR(30)  NOT NULL CHECK (tipo IN ('verificacion_email','reset_password')),
  expira_en   TIMESTAMPTZ  NOT NULL,
  usado_en    TIMESTAMPTZ,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (token)
);

CREATE INDEX idx_tokens_usuario ON tokens_usuario(usuario_id, tipo);


-- =============================================================================
-- BLOQUE 2 — GEOGRAFÍA JERÁRQUICA (país → región → localidad)
-- =============================================================================
--
-- Diseño escalable: hoy el sistema maneja 9 ciudades de Bolivia, pero la
-- jerarquía soporta que mañana se agreguen ciudades de cualquier país sin
-- cambios de esquema. El campo `geojson` en `regiones` habilita la mejora
-- #15 (simulación a nivel departamental con polígonos) sin nuevas tablas.
--
-- Normalización: 3FN. `localidades` no duplica `pais_id` (se deriva vía
-- `regiones`). Los nombres NO son únicos globalmente (existen varias ciudades
-- llamadas "Trinidad"); la unicidad natural es `(region_id, nombre)`.

CREATE TABLE paises (
  id        SERIAL      PRIMARY KEY,
  codigo    CHAR(2)     UNIQUE NOT NULL,          -- ISO 3166-1 alpha-2 ('BO', 'AR')
  nombre    VARCHAR(100) NOT NULL,
  geojson   JSONB                                 -- polígono del país (opcional)
);

CREATE TABLE regiones (
  id        SERIAL       PRIMARY KEY,
  pais_id   INT          NOT NULL REFERENCES paises(id) ON DELETE CASCADE,
  nombre    VARCHAR(150) NOT NULL,
  nivel     VARCHAR(30)  NOT NULL DEFAULT 'departamento'
              CHECK (nivel IN ('departamento','estado','provincia','region','territorio')),
  geojson   JSONB,
  UNIQUE (pais_id, nombre)
);

CREATE INDEX idx_regiones_pais ON regiones(pais_id);

CREATE TABLE localidades (
  id         SERIAL         PRIMARY KEY,
  region_id  INT            NOT NULL REFERENCES regiones(id) ON DELETE CASCADE,
  nombre     VARCHAR(150)   NOT NULL,
  latitud    DECIMAL(10, 7) NOT NULL CHECK (latitud BETWEEN -90  AND  90),
  longitud   DECIMAL(10, 7) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
  altitud_m  INT,
  activa     BOOLEAN        NOT NULL DEFAULT TRUE,
  UNIQUE (region_id, nombre)
);

CREATE INDEX idx_localidades_region ON localidades(region_id);
CREATE INDEX idx_localidades_coords ON localidades(latitud, longitud);


-- =============================================================================
-- BLOQUE 3 — CATÁLOGO DE MÉTRICAS, UNIDADES Y UMBRALES
-- =============================================================================
--
-- Escalabilidad: agregar PM2.5, CO₂ o UV en el futuro es un simple INSERT en
-- `metricas` — no requiere migraciones de código ni ALTER TABLE en `lecturas`.
-- La categoría permite agrupar métricas en la UI ("aire", "agua", "clima").
--
-- Soporte multi-unidad: `metricas` apunta a una unidad base (ej: °C), y la
-- tabla puente `metrica_unidades` define conversiones lineales alternativas
-- (ej: °F = °C × 1.8 + 32). Esto elimina duplicación de datos y respeta 4FN:
-- la relación M:N entre métrica y unidades se modela en su propia tabla.

CREATE TABLE categorias_metricas (
  id          SERIAL       PRIMARY KEY,
  clave       VARCHAR(30)  UNIQUE NOT NULL,    -- 'aire','agua','sonido','clima'
  nombre      VARCHAR(60)  NOT NULL,
  descripcion TEXT,
  icono       VARCHAR(50)                       -- nombre del ícono lucide-react
);

INSERT INTO categorias_metricas (clave, nombre, icono) VALUES
  ('aire',   'Calidad del aire',  'wind'),
  ('agua',   'Calidad del agua',  'droplet'),
  ('sonido', 'Ruido ambiental',   'volume-2'),
  ('clima',  'Clima y atmósfera', 'cloud-sun');

CREATE TABLE unidades (
  id       SERIAL       PRIMARY KEY,
  simbolo  VARCHAR(20)  UNIQUE NOT NULL,        -- '°C','°F','µg/m³','ppm','dB','%'
  nombre   VARCHAR(60)  NOT NULL,
  sistema  VARCHAR(20)  NOT NULL DEFAULT 'SI'   -- 'SI','imperial','indice'
             CHECK (sistema IN ('SI','imperial','indice','otro'))
);

CREATE TABLE metricas (
  id              SERIAL       PRIMARY KEY,
  clave           VARCHAR(50)  UNIQUE NOT NULL,  -- 'temperatura','aqi','pm25'
  nombre          VARCHAR(100) NOT NULL,
  categoria_id    INT          NOT NULL REFERENCES categorias_metricas(id),
  unidad_base_id  INT          NOT NULL REFERENCES unidades(id),
  descripcion     TEXT,
  valor_min       DECIMAL(10,3),                 -- rango físico admisible (sanity check)
  valor_max       DECIMAL(10,3),
  activa          BOOLEAN      NOT NULL DEFAULT TRUE,
  CHECK (valor_min IS NULL OR valor_max IS NULL OR valor_min < valor_max)
);

CREATE INDEX idx_metricas_categoria ON metricas(categoria_id);

-- Conversión lineal entre unidades alternativas y la unidad base de una métrica.
-- Fórmula: valor_unidad_alternativa = valor_base * factor + offset
-- Ejemplo: °F = °C * 1.8 + 32    →    factor=1.8, offset=32
CREATE TABLE metrica_unidades (
  metrica_id  INT           NOT NULL REFERENCES metricas(id) ON DELETE CASCADE,
  unidad_id   INT           NOT NULL REFERENCES unidades(id),
  factor      DECIMAL(14,6) NOT NULL DEFAULT 1.0,
  offset_val  DECIMAL(14,6) NOT NULL DEFAULT 0.0,
  PRIMARY KEY (metrica_id, unidad_id)
);

-- Umbrales (niveles de calidad) por métrica. La clave natural compuesta
-- (metrica_id, nivel) asegura BCNF; la unicidad de `label` dentro de métrica
-- también está declarada para evitar inconsistencias de etiquetas.
CREATE TABLE umbrales (
  id         SERIAL        PRIMARY KEY,
  metrica_id INT           NOT NULL REFERENCES metricas(id) ON DELETE CASCADE,
  nivel      SMALLINT      NOT NULL CHECK (nivel BETWEEN 1 AND 10),
  label      VARCHAR(50)   NOT NULL,            -- 'Bueno','Moderado','Peligroso'
  valor_min  DECIMAL(10,3) NOT NULL,
  valor_max  DECIMAL(10,3) NOT NULL,
  color_hex  CHAR(7)       NOT NULL CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  severidad  VARCHAR(20)   NOT NULL DEFAULT 'informativa'
               CHECK (severidad IN ('informativa','advertencia','critica','emergencia')),
  UNIQUE (metrica_id, nivel),
  UNIQUE (metrica_id, label),
  CHECK (valor_min < valor_max)
);

CREATE INDEX idx_umbrales_metrica ON umbrales(metrica_id);


-- =============================================================================
-- BLOQUE 4 — CATÁLOGO DE FUENTES DE DATOS
-- =============================================================================
--
-- ¿Por qué existe? El análisis recomienda integrar APIs externas reales
-- (Open-Meteo, WAQI, OpenAQ, SENAMHI). Usar VARCHAR libre en `lecturas.fuente`
-- haría imposible saber qué APIs realmente alimentan el sistema. El catálogo
-- permite deshabilitar fuentes, rastrear latencia, costos (si aplica) y
-- auditar qué dato vino de qué origen.

CREATE TABLE fuentes_datos (
  id          SERIAL       PRIMARY KEY,
  clave       VARCHAR(40)  UNIQUE NOT NULL,   -- 'simulacion','openmeteo','waqi','manual','sensor'
  nombre      VARCHAR(100) NOT NULL,
  tipo        VARCHAR(20)  NOT NULL CHECK (tipo IN ('simulacion','api_externa','manual','sensor')),
  url_base    VARCHAR(255),
  activa      BOOLEAN      NOT NULL DEFAULT TRUE,
  creada_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO fuentes_datos (clave, nombre, tipo, url_base) VALUES
  ('simulacion', 'Motor de simulación interna',    'simulacion',  NULL),
  ('manual',     'Inyección manual de usuario',    'manual',      NULL),
  ('openmeteo',  'Open-Meteo API',                 'api_externa', 'https://api.open-meteo.com/v1'),
  ('waqi',       'World Air Quality Index',        'api_externa', 'https://api.waqi.info'),
  ('openaq',     'OpenAQ',                         'api_externa', 'https://api.openaq.org/v2'),
  ('sensor',     'Sensor físico (genérico)',       'sensor',      NULL);


-- =============================================================================
-- BLOQUE 5 — LECTURAS EN SERIE DE TIEMPO (núcleo del sistema)
-- =============================================================================
--
-- Tabla más crítica del sistema. TimescaleDB particiona automáticamente por
-- `tiempo`, habilitando que consultas "últimas 24h", "promedio por mes" y
-- "agregación por hora" se ejecuten en milisegundos sobre cientos de millones
-- de filas.
--
-- Normalización: 2FN + BCNF. La PK compuesta (tiempo, localidad_id, metrica_id)
-- garantiza que no haya dos lecturas simultáneas de la misma métrica en la
-- misma localidad. `valor` y `fuente_id` dependen del triple completo.
--
-- `sesion_simulacion_id` es NULL cuando el dato proviene de API externa o
-- sensor — explica correctamente que la lectura NO pertenece a una simulación.

CREATE TABLE lecturas (
  tiempo               TIMESTAMPTZ   NOT NULL,
  localidad_id         INT           NOT NULL REFERENCES localidades(id) ON DELETE CASCADE,
  metrica_id           INT           NOT NULL REFERENCES metricas(id)    ON DELETE RESTRICT,
  valor                DECIMAL(12,4) NOT NULL,
  fuente_id            INT           NOT NULL REFERENCES fuentes_datos(id),
  sesion_simulacion_id INT,              -- FK agregada más abajo (forward reference)
  PRIMARY KEY (tiempo, localidad_id, metrica_id)
);

SELECT create_hypertable('lecturas', 'tiempo', if_not_exists => TRUE);

CREATE INDEX idx_lecturas_localidad  ON lecturas(localidad_id, tiempo DESC);
CREATE INDEX idx_lecturas_metrica    ON lecturas(metrica_id,   tiempo DESC);
CREATE INDEX idx_lecturas_fuente     ON lecturas(fuente_id);


-- =============================================================================
-- BLOQUE 6 — SESIONES DE SIMULACIÓN
-- =============================================================================
--
-- Permite reproducir simulaciones pasadas, comparar configuraciones y auditar
-- quién ejecutó qué. `configuracion JSONB` guarda el snapshot completo de
-- parámetros (intervalo, métricas activas, rangos) — inmutable por diseño.

CREATE TABLE sesiones_simulacion (
  id            SERIAL       PRIMARY KEY,
  usuario_id    INT          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  inicio        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  fin           TIMESTAMPTZ,
  intervalo_ms  INT          NOT NULL CHECK (intervalo_ms > 0),
  configuracion JSONB        NOT NULL DEFAULT '{}'::jsonb,
  total_ticks   INT          NOT NULL DEFAULT 0,
  CHECK (fin IS NULL OR fin >= inicio)
);

CREATE INDEX idx_sesiones_usuario ON sesiones_simulacion(usuario_id, inicio DESC);

-- Ahora que `sesiones_simulacion` existe, agregamos la FK diferida a `lecturas`.
ALTER TABLE lecturas
  ADD CONSTRAINT fk_lecturas_sesion
  FOREIGN KEY (sesion_simulacion_id) REFERENCES sesiones_simulacion(id) ON DELETE SET NULL;

CREATE INDEX idx_lecturas_sesion ON lecturas(sesion_simulacion_id)
  WHERE sesion_simulacion_id IS NOT NULL;


-- =============================================================================
-- BLOQUE 7 — ALERTAS Y SUSCRIPCIONES
-- =============================================================================
--
-- `alertas`    → eventos: ocurrió un valor fuera de umbral en tal momento.
-- `suscripciones_alertas` → preferencias: qué usuario quiere ser notificado
--                           sobre qué localidad/métrica y a partir de qué nivel.
--
-- La separación evita mezclar "qué pasó" (hechos inmutables) con "quién
-- quiere enterarse" (preferencias mutables) — respeta 4FN: la relación M:N
-- Usuario ↔ (Localidad × Métrica) vive en su propia tabla puente.

CREATE TABLE alertas (
  id               BIGSERIAL     PRIMARY KEY,
  tiempo           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  localidad_id     INT           NOT NULL REFERENCES localidades(id) ON DELETE CASCADE,
  metrica_id       INT           NOT NULL REFERENCES metricas(id)    ON DELETE RESTRICT,
  umbral_id        INT           NOT NULL REFERENCES umbrales(id),
  valor            DECIMAL(12,4) NOT NULL,            -- valor congelado al momento del evento
  reconocida       BOOLEAN       NOT NULL DEFAULT FALSE,
  reconocida_por   INT           REFERENCES usuarios(id) ON DELETE SET NULL,
  reconocida_en    TIMESTAMPTZ,
  CHECK ((reconocida = FALSE) OR (reconocida_en IS NOT NULL))
);

CREATE INDEX idx_alertas_localidad_metrica ON alertas(localidad_id, metrica_id, tiempo DESC);
CREATE INDEX idx_alertas_pendientes        ON alertas(tiempo DESC) WHERE reconocida = FALSE;

CREATE TABLE suscripciones_alertas (
  usuario_id       INT     NOT NULL REFERENCES usuarios(id)     ON DELETE CASCADE,
  localidad_id     INT     NOT NULL REFERENCES localidades(id)  ON DELETE CASCADE,
  metrica_id       INT     NOT NULL REFERENCES metricas(id)     ON DELETE CASCADE,
  nivel_minimo     SMALLINT NOT NULL DEFAULT 3 CHECK (nivel_minimo BETWEEN 1 AND 10),
  canal            VARCHAR(20) NOT NULL DEFAULT 'in_app'
                     CHECK (canal IN ('in_app','email','push','webhook')),
  activa           BOOLEAN NOT NULL DEFAULT TRUE,
  creada_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, localidad_id, metrica_id, canal)
);


-- =============================================================================
-- BLOQUE 8 — REPORTES GENERADOS
-- =============================================================================
--
-- Persistir reportes evita recalcular sobre millones de lecturas cada vez que
-- un usuario abre uno ya generado. `parametros` es un snapshot inmutable de
-- filtros; `contenido` guarda el texto/análisis final (puede ser generado
-- por IA). `url_pdf` apunta al PDF exportado (backend con puppeteer o frontend
-- con jsPDF).

CREATE TABLE reportes (
  id          SERIAL       PRIMARY KEY,
  usuario_id  INT          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  titulo      VARCHAR(255) NOT NULL,
  tipo        VARCHAR(30)  NOT NULL CHECK (tipo IN ('historico','comparativo','anomalias','ia','kpi')),
  parametros  JSONB        NOT NULL,
  contenido   TEXT,
  url_pdf     VARCHAR(500),
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reportes_usuario ON reportes(usuario_id, creado_en DESC);
CREATE INDEX idx_reportes_tipo    ON reportes(tipo);


-- =============================================================================
-- BLOQUE 9 — AGENTE IA (conversaciones multi-turno)
-- =============================================================================
--
-- Dividido en `conversaciones_ia` (thread) y `mensajes_ia` (turnos) para
-- respetar 3FN: los atributos del thread (título, resumen) NO se repiten en
-- cada mensaje. `tokens_usados` y `costo_usd` permiten monitorear el gasto
-- de la API de Claude/OpenAI (punto crítico mencionado en ANALISIS_MEJORAS
-- sección 19).

CREATE TABLE conversaciones_ia (
  id          SERIAL       PRIMARY KEY,
  usuario_id  INT          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo      VARCHAR(255),
  modelo      VARCHAR(60)  NOT NULL DEFAULT 'claude-sonnet-4-6',
  inicio      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ultimo_mensaje_en TIMESTAMPTZ
);

CREATE INDEX idx_conversaciones_usuario ON conversaciones_ia(usuario_id, inicio DESC);

CREATE TABLE mensajes_ia (
  id              BIGSERIAL    PRIMARY KEY,
  conversacion_id INT          NOT NULL REFERENCES conversaciones_ia(id) ON DELETE CASCADE,
  rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('usuario','asistente','sistema','herramienta')),
  contenido       TEXT         NOT NULL,
  tokens_entrada  INT,
  tokens_salida   INT,
  costo_usd       DECIMAL(10,6),
  tiempo          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mensajes_conversacion ON mensajes_ia(conversacion_id, tiempo);


-- =============================================================================
-- BLOQUE 10 — PREFERENCIAS Y FAVORITOS DE USUARIO
-- =============================================================================
--
-- `preferencias_usuario` → una fila por usuario con preferencias globales (tema).
-- `preferencias_usuario_metrica` → preferencia por métrica (unidad preferida).
-- `favoritos_usuario` → lista de localidades favoritas (relación M:N → 4FN).
--
-- Separar estas tablas evita que `usuarios` tenga columnas que 90% del tiempo
-- serán NULL (una por métrica, otra por localidad favorita, etc.). Además
-- respeta 4FN: múltiples favoritos y múltiples preferencias por métrica son
-- dependencias multivaluadas que exigen tabla propia.

CREATE TABLE preferencias_usuario (
  usuario_id    INT          PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  tema          VARCHAR(10)  NOT NULL DEFAULT 'oscuro' CHECK (tema IN ('claro','oscuro','sistema')),
  idioma        VARCHAR(5)   NOT NULL DEFAULT 'es',
  estilo_mapa   VARCHAR(60)  NOT NULL DEFAULT 'dark-v11',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE preferencias_usuario_metrica (
  usuario_id  INT NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  metrica_id  INT NOT NULL REFERENCES metricas(id)  ON DELETE CASCADE,
  unidad_id   INT NOT NULL REFERENCES unidades(id),
  PRIMARY KEY (usuario_id, metrica_id)
);

CREATE TABLE favoritos_usuario (
  usuario_id    INT         NOT NULL REFERENCES usuarios(id)    ON DELETE CASCADE,
  localidad_id  INT         NOT NULL REFERENCES localidades(id) ON DELETE CASCADE,
  agregado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, localidad_id)
);


-- =============================================================================
-- DATOS INICIALES MÍNIMOS — BOLIVIA (9 departamentos actuales del MVP)
-- =============================================================================

INSERT INTO paises (codigo, nombre) VALUES ('BO', 'Bolivia');

INSERT INTO regiones (pais_id, nombre, nivel)
SELECT p.id, r.nombre, 'departamento'
FROM paises p,
     (VALUES ('La Paz'),('Cochabamba'),('Santa Cruz'),('Oruro'),
             ('Potosí'),('Chuquisaca'),('Tarija'),('Beni'),('Pando')) AS r(nombre)
WHERE p.codigo = 'BO';

INSERT INTO localidades (region_id, nombre, latitud, longitud) VALUES
  ((SELECT id FROM regiones WHERE nombre='La Paz'),      'La Paz',     -16.4897, -68.1193),
  ((SELECT id FROM regiones WHERE nombre='Cochabamba'),  'Cochabamba', -17.3895, -66.1568),
  ((SELECT id FROM regiones WHERE nombre='Santa Cruz'),  'Santa Cruz', -17.7833, -63.1812),
  ((SELECT id FROM regiones WHERE nombre='Oruro'),       'Oruro',      -17.9624, -67.1061),
  ((SELECT id FROM regiones WHERE nombre='Potosí'),      'Potosí',     -19.5836, -65.7531),
  ((SELECT id FROM regiones WHERE nombre='Chuquisaca'),  'Sucre',      -19.0353, -65.2592),
  ((SELECT id FROM regiones WHERE nombre='Tarija'),      'Tarija',     -21.5355, -64.7296),
  ((SELECT id FROM regiones WHERE nombre='Beni'),        'Trinidad',   -14.8333, -64.9000),
  ((SELECT id FROM regiones WHERE nombre='Pando'),       'Cobija',     -11.0267, -68.7692);

INSERT INTO unidades (simbolo, nombre, sistema) VALUES
  ('°C',    'Grados Celsius',    'SI'),
  ('°F',    'Grados Fahrenheit', 'imperial'),
  ('K',     'Kelvin',            'SI'),
  ('µg/m³', 'Microgramos por metro cúbico', 'SI'),
  ('ppm',   'Partes por millón', 'SI'),
  ('ppb',   'Partes por billón', 'SI'),
  ('dB',    'Decibelios',        'SI'),
  ('%',     'Porcentaje',        'indice'),
  ('hPa',   'Hectopascales',     'SI'),
  ('km/h',  'Kilómetros por hora', 'SI'),
  ('mm',    'Milímetros',        'SI'),
  ('AQI',   'Índice de calidad del aire', 'indice'),
  ('ICA',   'Índice de calidad del agua', 'indice'),
  ('UVI',   'Índice UV',         'indice');

INSERT INTO metricas (clave, nombre, categoria_id, unidad_base_id, valor_min, valor_max) VALUES
  ('temperatura', 'Temperatura',       (SELECT id FROM categorias_metricas WHERE clave='clima'),
                                        (SELECT id FROM unidades WHERE simbolo='°C'),     -50, 60),
  ('aqi',         'Calidad del aire (AQI)', (SELECT id FROM categorias_metricas WHERE clave='aire'),
                                        (SELECT id FROM unidades WHERE simbolo='AQI'),    0,   500),
  ('ica',         'Calidad del agua (ICA)', (SELECT id FROM categorias_metricas WHERE clave='agua'),
                                        (SELECT id FROM unidades WHERE simbolo='ICA'),    0,   100),
  ('ruido',       'Ruido ambiental',   (SELECT id FROM categorias_metricas WHERE clave='sonido'),
                                        (SELECT id FROM unidades WHERE simbolo='dB'),     0,   140),
  ('humedad',     'Humedad relativa',  (SELECT id FROM categorias_metricas WHERE clave='clima'),
                                        (SELECT id FROM unidades WHERE simbolo='%'),      0,   100);

-- Conversión °C ↔ °F (ejemplo de uso de metrica_unidades).
INSERT INTO metrica_unidades (metrica_id, unidad_id, factor, offset_val)
SELECT m.id, u.id, 1.8, 32.0
FROM metricas m, unidades u
WHERE m.clave = 'temperatura' AND u.simbolo = '°F';

-- Umbrales AQI (estándar EPA) — sirven como ejemplo canónico.
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, v.nivel, v.label, v.vmin, v.vmax, v.color, v.sev
FROM metricas m,
     (VALUES
        (1, 'Bueno',                  0,   50,  '#00e400', 'informativa'),
        (2, 'Moderado',               51,  100, '#ffff00', 'informativa'),
        (3, 'Dañino (sensibles)',     101, 150, '#ff7e00', 'advertencia'),
        (4, 'No saludable',           151, 200, '#ff0000', 'critica'),
        (5, 'Muy no saludable',       201, 300, '#8f3f97', 'critica'),
        (6, 'Peligroso',              301, 500, '#7e0023', 'emergencia')
     ) AS v(nivel, label, vmin, vmax, color, sev)
WHERE m.clave = 'aqi';


-- =============================================================================
-- VISTAS MATERIALIZADAS RECOMENDADAS (opcional — mejoran reportes)
-- =============================================================================
--
-- TimescaleDB ofrece "continuous aggregates" que recalculan incrementalmente.
-- Ejemplo: promedio horario por localidad y métrica para reportes rápidos.
-- Se puede crear cuando las tablas tengan datos reales:
--
--   CREATE MATERIALIZED VIEW lecturas_hora
--   WITH (timescaledb.continuous) AS
--   SELECT time_bucket('1 hour', tiempo) AS hora,
--          localidad_id, metrica_id,
--          AVG(valor) AS promedio, MIN(valor) AS minimo, MAX(valor) AS maximo
--   FROM lecturas
--   GROUP BY hora, localidad_id, metrica_id;


-- =============================================================================
-- ESCALABILIDAD — RESUMEN
-- =============================================================================
--
-- 1. VOLUMEN DE DATOS
--    `lecturas` es hypertable particionada por tiempo. A 9 localidades × 5
--    métricas × 1 lectura/segundo = 43M filas/día. TimescaleDB maneja esto
--    con compresión nativa (columnar, ratios 10-20x) y eliminación de
--    particiones antiguas con `drop_chunks()`.
--
-- 2. CRECIMIENTO GEOGRÁFICO
--    Agregar un país nuevo = INSERT en `paises`, `regiones`, `localidades`.
--    Cero cambios de código ni migraciones.
--
-- 3. CRECIMIENTO DE MÉTRICAS
--    Agregar PM2.5, CO₂, UV = INSERT en `metricas` + `umbrales`. Cero ALTER
--    TABLE sobre `lecturas` (que es el reto típico de esquemas "wide").
--
-- 4. MULTI-UNIDAD Y MULTI-IDIOMA
--    `unidades` + `metrica_unidades` soportan conversión declarativa; el
--    frontend pide la unidad preferida del usuario y convierte en la query.
--
-- 5. MULTI-FUENTE
--    Conectar Open-Meteo, WAQI, OpenAQ requiere sólo un INSERT en
--    `fuentes_datos` y un job que INSERT en `lecturas` con el `fuente_id`
--    correspondiente. El histórico mantiene trazabilidad por fuente.
--
-- 6. ÍNDICES PARA CONSULTAS FRECUENTES
--    - `(localidad_id, tiempo DESC)` y `(metrica_id, tiempo DESC)` cubren
--      las consultas del mapa, panel de simulación y dashboards de reporte.
--    - Índice parcial `WHERE reconocida = FALSE` sobre `alertas` acelera el
--      caso más consultado (alertas pendientes) sin costar en inserción.
--    - Índice GIN sobre `reportes.parametros` (agregable cuando haga falta)
--      permite buscar reportes por filtros aplicados.
--
-- 7. FORMAS NORMALES CUMPLIDAS
--    1FN ✓   2FN ✓   3FN ✓   BCNF ✓   4FN ✓
--    Cualquier refactor futuro (ej: permisos granulares en tabla `permisos`)
--    es aditivo — no requiere reestructurar las relaciones existentes.
--
-- =============================================================================
-- FIN DEL ESQUEMA
-- =============================================================================
