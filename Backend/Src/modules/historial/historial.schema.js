const { z } = require('zod');

const seedHistorialSchema = z.object({
  dias:  z.number().int().min(1).max(365).optional(),
  horas: z.number().int().min(1).max(24).optional(),
});

const historialQuerySchema = z.object({
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
  localidad: z.string().min(1).max(100).optional(),
  metrica:   z.string().min(1).max(50).optional(),
});

module.exports = { seedHistorialSchema, historialQuerySchema };
