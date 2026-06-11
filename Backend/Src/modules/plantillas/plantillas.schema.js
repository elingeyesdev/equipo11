const { z } = require('zod');

const crearPlantillaSchema = z.object({
  nombre_plantilla: z.string().min(1).max(255),
  tipo:             z.string().min(1).max(100),
  configuracion:    z.record(z.unknown()),
});

module.exports = { crearPlantillaSchema };
