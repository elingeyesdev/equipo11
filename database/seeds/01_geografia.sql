-- ============================================================
-- SEED: Geografía básica (Bolivia)
-- ============================================================

INSERT INTO paises (nombre, codigo) VALUES ('Bolivia', 'BO') ON CONFLICT (codigo) DO NOTHING;

INSERT INTO regiones (pais_id, nombre, nivel)
SELECT id, 'La Paz', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Cochabamba', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Santa Cruz', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Oruro', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Potosí', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Sucre', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Tarija', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Beni', 'departamento' FROM paises WHERE codigo = 'BO' UNION ALL
SELECT id, 'Pando', 'departamento' FROM paises WHERE codigo = 'BO'
ON CONFLICT (pais_id, nombre) DO NOTHING;

INSERT INTO localidades (region_id, nombre, latitud, longitud)
SELECT r.id, 'La Paz', -16.4897, -68.1193 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'La Paz' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Cochabamba', -17.3895, -66.1568 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Cochabamba' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Santa Cruz', -17.7833, -63.1812 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Santa Cruz' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Oruro', -17.9624, -67.1061 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Oruro' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Potosí', -19.5836, -65.7531 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Potosí' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Sucre', -19.0353, -65.2592 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Sucre' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Tarija', -21.5355, -64.7296 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Tarija' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Trinidad', -14.8333, -64.9000 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Beni' AND p.codigo = 'BO' UNION ALL
SELECT r.id, 'Cobija', -11.0267, -68.7692 FROM regiones r JOIN paises p ON r.pais_id = p.id WHERE r.nombre = 'Pando' AND p.codigo = 'BO'
ON CONFLICT (region_id, nombre) DO NOTHING;

