const { z } = require('zod');

const generarReporteSchema = z.object({
  formato: z.enum(['pdf', 'excel']).default('pdf'),
  fechaInicio: z.string().datetime().optional(),
  fechaFin:    z.string().datetime().optional(),
  ciudad:      z.string().min(1).max(100).optional(),
  metrica:     z.string().min(1).max(50).optional(),
});

module.exports = { generarReporteSchema };
