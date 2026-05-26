const { z } = require('zod');

const generarReporteSchema = z.object({
  formato: z.enum(['pdf', 'excel']).default('pdf'),
  titulo: z.string().optional(),
  columnas: z.array(
    z.object({
      header: z.string(),
      key: z.string()
    })
  ),
  datos: z.array(z.record(z.any()))
});

module.exports = { generarReporteSchema };
