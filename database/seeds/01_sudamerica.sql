-- =============================================================================
-- Seeder: Ciudades de Sudamérica
-- Archivo: database/seeds/01_sudamerica.sql
-- Propósito: Poblar paises, regiones y localidades con ~65 ciudades
--            representativas de Sudamérica para cobertura geográfica del mapa.
-- Ejecución: psql -U admin -d sistema_ambiental -f 01_sudamerica.sql
-- =============================================================================

-- ─── 1. PAÍSES ───────────────────────────────────────────────────────────────
INSERT INTO paises (codigo, nombre) VALUES
  ('AR', 'Argentina'),
  ('BR', 'Brasil'),
  ('CL', 'Chile'),
  ('CO', 'Colombia'),
  ('EC', 'Ecuador'),
  ('GF', 'Guyana Francesa'),
  ('GY', 'Guyana'),
  ('PE', 'Perú'),
  ('PY', 'Paraguay'),
  ('SR', 'Surinam'),
  ('UY', 'Uruguay'),
  ('VE', 'Venezuela')
ON CONFLICT (codigo) DO NOTHING;

-- ─── 2. REGIONES (una por ciudad capital/principal) ───────────────────────────

-- Argentina
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='AR'), 'Buenos Aires',  'provincia'),
  ((SELECT id FROM paises WHERE codigo='AR'), 'Córdoba',       'provincia'),
  ((SELECT id FROM paises WHERE codigo='AR'), 'Santa Fe',      'provincia'),
  ((SELECT id FROM paises WHERE codigo='AR'), 'Mendoza',       'provincia'),
  ((SELECT id FROM paises WHERE codigo='AR'), 'Tucumán',       'provincia'),
  ((SELECT id FROM paises WHERE codigo='AR'), 'Salta',         'provincia'),
  ((SELECT id FROM paises WHERE codigo='AR'), 'Río Negro',     'provincia'),
  ((SELECT id FROM paises WHERE codigo='AR'), 'Tierra del Fuego', 'provincia')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Brasil
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='BR'), 'Distrito Federal', 'estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'São Paulo',        'estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'Rio de Janeiro',   'estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'Amazonas',         'estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'Pará',             'estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'Ceará',            'estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'Bahia',            'estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'Rio Grande do Sul','estado'),
  ((SELECT id FROM paises WHERE codigo='BR'), 'Mato Grosso',      'estado')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Chile
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='CL'), 'Región Metropolitana', 'region'),
  ((SELECT id FROM paises WHERE codigo='CL'), 'Valparaíso',           'region'),
  ((SELECT id FROM paises WHERE codigo='CL'), 'Biobío',               'region'),
  ((SELECT id FROM paises WHERE codigo='CL'), 'Antofagasta',          'region'),
  ((SELECT id FROM paises WHERE codigo='CL'), 'Magallanes',           'region'),
  ((SELECT id FROM paises WHERE codigo='CL'), 'Tarapacá',             'region')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Colombia
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='CO'), 'Cundinamarca',    'departamento'),
  ((SELECT id FROM paises WHERE codigo='CO'), 'Antioquia',       'departamento'),
  ((SELECT id FROM paises WHERE codigo='CO'), 'Valle del Cauca', 'departamento'),
  ((SELECT id FROM paises WHERE codigo='CO'), 'Bolívar',         'departamento'),
  ((SELECT id FROM paises WHERE codigo='CO'), 'Atlántico',       'departamento'),
  ((SELECT id FROM paises WHERE codigo='CO'), 'Amazonas',        'departamento')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Ecuador
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='EC'), 'Pichincha',    'provincia'),
  ((SELECT id FROM paises WHERE codigo='EC'), 'Guayas',       'provincia'),
  ((SELECT id FROM paises WHERE codigo='EC'), 'Azuay',        'provincia'),
  ((SELECT id FROM paises WHERE codigo='EC'), 'Sucumbíos',    'provincia')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Perú
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='PE'), 'Lima',         'region'),
  ((SELECT id FROM paises WHERE codigo='PE'), 'Cusco',        'region'),
  ((SELECT id FROM paises WHERE codigo='PE'), 'Arequipa',     'region'),
  ((SELECT id FROM paises WHERE codigo='PE'), 'La Libertad',  'region'),
  ((SELECT id FROM paises WHERE codigo='PE'), 'Loreto',       'region'),
  ((SELECT id FROM paises WHERE codigo='PE'), 'Puno',         'region')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Paraguay
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='PY'), 'Central',          'departamento'),
  ((SELECT id FROM paises WHERE codigo='PY'), 'Alto Paraná',      'departamento'),
  ((SELECT id FROM paises WHERE codigo='PY'), 'Itapúa',           'departamento')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Uruguay
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='UY'), 'Montevideo',   'departamento'),
  ((SELECT id FROM paises WHERE codigo='UY'), 'Salto',        'departamento'),
  ((SELECT id FROM paises WHERE codigo='UY'), 'Rivera',       'departamento')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Venezuela
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='VE'), 'Distrito Capital', 'estado'),
  ((SELECT id FROM paises WHERE codigo='VE'), 'Zulia',            'estado'),
  ((SELECT id FROM paises WHERE codigo='VE'), 'Carabobo',         'estado'),
  ((SELECT id FROM paises WHERE codigo='VE'), 'Amazonas',         'estado')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- Guyana, Surinam, Guyana Francesa
INSERT INTO regiones (pais_id, nombre, nivel) VALUES
  ((SELECT id FROM paises WHERE codigo='GY'), 'Demerara-Mahaica', 'region'),
  ((SELECT id FROM paises WHERE codigo='SR'), 'Paramaribo',       'region'),
  ((SELECT id FROM paises WHERE codigo='GF'), 'Cayenne',          'region')
ON CONFLICT (pais_id, nombre) DO NOTHING;

-- ─── 3. LOCALIDADES ───────────────────────────────────────────────────────────

-- Argentina
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Buenos Aires'),
   'Buenos Aires',  -34.6037, -58.3816, 25),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Córdoba'),
   'Córdoba',       -31.4135, -64.1811, 431),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Santa Fe'),
   'Rosario',       -32.9442, -60.6505, 25),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Mendoza'),
   'Mendoza',       -32.8908, -68.8272, 827),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Tucumán'),
   'Tucumán',       -26.8083, -65.2176, 465),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Salta'),
   'Salta',         -24.7821, -65.4232, 1187),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Río Negro'),
   'Bariloche',     -41.1335, -71.3103, 770),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='AR' AND r.nombre='Tierra del Fuego'),
   'Ushuaia',       -54.8019, -68.3030, 14)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Brasil
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Distrito Federal'),
   'Brasilia',       -15.7801, -47.9292, 1172),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='São Paulo'),
   'São Paulo',      -23.5505, -46.6333, 760),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Rio de Janeiro'),
   'Rio de Janeiro', -22.9068, -43.1729, 10),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Amazonas'),
   'Manaus',         -3.1019,  -60.0250, 92),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Pará'),
   'Belém',          -1.4558,  -48.5044, 10),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Ceará'),
   'Fortaleza',      -3.7172,  -38.5433, 21),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Bahia'),
   'Salvador',       -12.9714, -38.5014, 8),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Rio Grande do Sul'),
   'Porto Alegre',   -30.0346, -51.2177, 10),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='BR' AND r.nombre='Mato Grosso'),
   'Cuiabá',        -15.5989, -56.0949, 165)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Chile
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CL' AND r.nombre='Región Metropolitana'),
   'Santiago',       -33.4489, -70.6693, 520),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CL' AND r.nombre='Valparaíso'),
   'Valparaíso',     -33.0472, -71.6127, 41),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CL' AND r.nombre='Biobío'),
   'Concepción',     -36.8270, -73.0503, 12),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CL' AND r.nombre='Antofagasta'),
   'Antofagasta',    -23.6509, -70.3975, 10),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CL' AND r.nombre='Magallanes'),
   'Punta Arenas',   -53.1638, -70.9171, 6),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CL' AND r.nombre='Tarapacá'),
   'Iquique',        -20.2208, -70.1431, 10)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Colombia
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CO' AND r.nombre='Cundinamarca'),
   'Bogotá',         4.7110,  -74.0721, 2625),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CO' AND r.nombre='Antioquia'),
   'Medellín',       6.2442,  -75.5812, 1495),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CO' AND r.nombre='Valle del Cauca'),
   'Cali',           3.4516,  -76.5320, 1018),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CO' AND r.nombre='Bolívar'),
   'Cartagena',      10.3910, -75.4794, 2),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CO' AND r.nombre='Atlántico'),
   'Barranquilla',   10.9639, -74.7964, 18),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='CO' AND r.nombre='Amazonas'),
   'Leticia',        -4.2153, -69.9406, 96)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Ecuador
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='EC' AND r.nombre='Pichincha'),
   'Quito',          -0.2295, -78.5243, 2850),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='EC' AND r.nombre='Guayas'),
   'Guayaquil',      -2.1894, -79.8891, 4),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='EC' AND r.nombre='Azuay'),
   'Cuenca',         -2.9001, -79.0059, 2530),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='EC' AND r.nombre='Sucumbíos'),
   'Lago Agrio',      0.0897, -76.8817, 310)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Perú
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PE' AND r.nombre='Lima'),
   'Lima',           -12.0464, -77.0428, 154),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PE' AND r.nombre='Cusco'),
   'Cusco',          -13.5319, -71.9675, 3399),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PE' AND r.nombre='Arequipa'),
   'Arequipa',       -16.4090, -71.5375, 2335),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PE' AND r.nombre='La Libertad'),
   'Trujillo',       -8.1120,  -79.0288, 34),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PE' AND r.nombre='Loreto'),
   'Iquitos',        -3.7491,  -73.2538, 104),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PE' AND r.nombre='Puno'),
   'Puno',           -15.8402, -70.0219, 3827)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Paraguay
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PY' AND r.nombre='Central'),
   'Asunción',        -25.2867, -57.6470, 101),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PY' AND r.nombre='Alto Paraná'),
   'Ciudad del Este', -25.5097, -54.6100, 219),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='PY' AND r.nombre='Itapúa'),
   'Encarnación',     -27.3309, -55.8660, 97)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Uruguay
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='UY' AND r.nombre='Montevideo'),
   'Montevideo',     -34.9011, -56.1645, 43),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='UY' AND r.nombre='Salto'),
   'Salto',          -31.3833, -57.9667, 50),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='UY' AND r.nombre='Rivera'),
   'Rivera',         -30.9053, -55.5506, 210)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Venezuela
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='VE' AND r.nombre='Distrito Capital'),
   'Caracas',        10.4806, -66.9036, 900),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='VE' AND r.nombre='Zulia'),
   'Maracaibo',      10.6544, -71.6011, 6),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='VE' AND r.nombre='Carabobo'),
   'Valencia',       10.1622, -67.9947, 479),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='VE' AND r.nombre='Amazonas'),
   'Puerto Ayacucho', 5.6638, -67.6235, 75)
ON CONFLICT (region_id, nombre) DO NOTHING;

-- Guyana, Surinam, Guyana Francesa
INSERT INTO localidades (region_id, nombre, latitud, longitud, altitud_m) VALUES
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='GY' AND r.nombre='Demerara-Mahaica'),
   'Georgetown',      6.8013, -58.1551, 1),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='SR' AND r.nombre='Paramaribo'),
   'Paramaribo',      5.8520, -55.2038, 3),
  ((SELECT r.id FROM regiones r JOIN paises p ON r.pais_id=p.id WHERE p.codigo='GF' AND r.nombre='Cayenne'),
   'Cayenne',         4.9224, -52.3135, 6)
ON CONFLICT (region_id, nombre) DO NOTHING;
