const { z } = require('zod');

const trendSchema = z.object({
  localidad_id:     z.number().int().positive('localidad_id es requerido y debe ser positivo'),
  metrica_clave:   z.string().min(1).max(50),
  horas_prediccion: z.number().int().min(24).max(168).optional().default(48),
});

const correlationsSchema = z.object({
  localidad_id: z.number().int().positive('localidad_id es requerido y debe ser positivo'),
});

const scenarioSchema = z.object({
  localidad_id:     z.number().int().positive('localidad_id es requerido y debe ser positivo'),
  metrica_clave:   z.string().min(1).max(50),
  horas_prediccion: z.number().int().min(24).max(168).optional().default(48),
});

const reportSchema = z.object({
  localidad_id:     z.number().int().positive('localidad_id es requerido y debe ser positivo'),
  horas_prediccion: z.number().int().min(24).max(168).optional().default(48),
});

module.exports = {
  trendSchema,
  correlationsSchema,
  scenarioSchema,
  reportSchema
};
