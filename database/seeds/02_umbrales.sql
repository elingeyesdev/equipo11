-- ============================================================
-- SEED: Umbrales por métrica (estándares EPA 2024, OMS, NIOSH)
-- Aplica globalmente — no dependen del país/región
-- ============================================================

-- Primero, asegurarnos de que existen las métricas
INSERT INTO metricas (clave, nombre, descripcion) VALUES
('aqi', 'Calidad del Aire', 'Índice de Calidad del Aire (AQI)'),
('temperatura', 'Temperatura', 'Temperatura en grados Celsius'),
('ica', 'Calidad del Agua', 'Índice de Calidad del Agua'),
('ruido', 'Nivel de Ruido', 'Nivel de ruido en decibelios'),
('humedad', 'Humedad', 'Porcentaje de humedad relativa')
ON CONFLICT (clave) DO NOTHING;

-- AQI (EPA 2024 — actualización mayo 2024, PM2.5 ajustado)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Bueno',                   0,   50,  '#00e400', 'informativa'  FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 2, 'Moderado',               51,  100,  '#ffff00', 'informativa'  FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 3, 'Dañino para sensibles', 101,  150,  '#ff7e00', 'advertencia'  FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 4, 'No saludable',          151,  200,  '#ff0000', 'critica'      FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 5, 'Muy no saludable',      201,  300,  '#8f3f97', 'critica'      FROM metricas m WHERE m.clave = 'aqi'
UNION ALL
SELECT m.id, 6, 'Peligroso',             301,  500,  '#7e0023', 'emergencia'   FROM metricas m WHERE m.clave = 'aqi'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- Temperatura (°C — confort OMS + riesgo clínico)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Frío extremo',   -100,  -10,  '#08306b', 'emergencia'  FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 2, 'Frío',            -10,    5,  '#2171b5', 'advertencia' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 3, 'Fresco',            5,   18,  '#6baed6', 'informativa' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 4, 'Confortable',      18,   26,  '#74c476', 'informativa' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 5, 'Cálido',           26,   32,  '#fee08b', 'informativa' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 6, 'Calor',            32,   38,  '#fd8d3c', 'advertencia' FROM metricas m WHERE m.clave = 'temperatura'
UNION ALL
SELECT m.id, 7, 'Calor extremo',    38,  100,  '#bd0026', 'emergencia'  FROM metricas m WHERE m.clave = 'temperatura'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- ICA — Calidad del Agua (NSF/CCME 0–100, INVERTIDO: más alto = mejor)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Muy mala',   0,  25,  '#6d4c41', 'emergencia'  FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 2, 'Mala',      26,  50,  '#f57c00', 'critica'     FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 3, 'Regular',   51,  70,  '#fbc02d', 'advertencia' FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 4, 'Buena',     71,  90,  '#1976d2', 'informativa' FROM metricas m WHERE m.clave = 'ica'
UNION ALL
SELECT m.id, 5, 'Excelente', 91, 100,  '#0d47a1', 'informativa' FROM metricas m WHERE m.clave = 'ica'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- Ruido (dB — NIOSH + OMS 2018)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Silencio',   0,  30,  '#1a9850', 'informativa' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 2, 'Tranquilo', 30,  55,  '#91cf60', 'informativa' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 3, 'Moderado',  55,  70,  '#ffffbf', 'informativa' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 4, 'Ruidoso',   70,  85,  '#fc8d59', 'advertencia' FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 5, 'Dañino',    85, 100,  '#d73027', 'critica'     FROM metricas m WHERE m.clave = 'ruido'
UNION ALL
SELECT m.id, 6, 'Peligroso', 100, 200, '#7f0000', 'emergencia'  FROM metricas m WHERE m.clave = 'ruido'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;

-- Humedad (% — zonas de confort)
INSERT INTO umbrales (metrica_id, nivel, label, valor_min, valor_max, color_hex, severidad)
SELECT m.id, 1, 'Muy seco',    0,  20,  '#fdae61', 'advertencia' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 2, 'Seco',       20,  40,  '#fee090', 'informativa' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 3, 'Confortable',40,  60,  '#abd9e9', 'informativa' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 4, 'Húmedo',     60,  80,  '#74add1', 'informativa' FROM metricas m WHERE m.clave = 'humedad'
UNION ALL
SELECT m.id, 5, 'Muy húmedo', 80, 100,  '#313695', 'advertencia' FROM metricas m WHERE m.clave = 'humedad'
ON CONFLICT (metrica_id, nivel) DO UPDATE
  SET label = EXCLUDED.label, valor_min = EXCLUDED.valor_min,
      valor_max = EXCLUDED.valor_max, color_hex = EXCLUDED.color_hex,
      severidad = EXCLUDED.severidad;
