const { z } = require('zod');

const alertasQuerySchema = z.object({
  desde:     z.string().datetime().optional(),
  hasta:     z.string().datetime().optional(),
  metrica:   z.string().min(1).max(50).optional(),
  severidad: z.enum(['advertencia', 'critica', 'emergencia']).optional(),
  reconocida: z.enum(['true', 'false']).optional(),
  tipo:      z.enum(['real', 'prediccion']).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});

const reconocerBodySchema = z.object({
  usuarioId: z.number().int().positive('usuarioId es requerido y debe ser un entero positivo'),
});

module.exports = { alertasQuerySchema, reconocerBodySchema };
