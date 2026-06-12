const { z } = require('zod');

const createSimSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200, 'El nombre es demasiado largo'),
  descripcion: z.string().optional(),
  localidad_id: z.number().int().positive('localidad_id es requerido y debe ser positivo'),
  tipo_evento: z.string().min(1, 'tipo_evento es requerido').max(50),
  area_geo: z.union([
    z.array(z.any()),
    z.object({}).passthrough()
  ], { message: 'area_geo debe ser un array de coordenadas o un objeto GeoJSON' }),
  parametros: z.object({
    intensidad: z.number().min(0.1, 'La intensidad mínima es 0.1').max(10.0, 'La intensidad máxima es 10.0').default(2.0),
    duracion_horas: z.number().int().min(1, 'La duración mínima es 1 hora').max(168, 'La duración máxima es 168 horas').default(24),
    metricas_afectadas: z.array(z.string()).optional()
  })
});

module.exports = {
  createSimSchema
};
