const { z } = require('zod');

const crearSensorMqttSchema = z.object({
  nombre: z.string({ required_error: 'El nombre del sensor es requerido' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres'),
  latitud: z.number({ required_error: 'La latitud es requerida' })
    .min(-90, 'La latitud debe estar entre -90 y 90')
    .max(90, 'La latitud debe estar entre -90 y 90'),
  longitud: z.number({ required_error: 'La longitud es requerida' })
    .min(-180, 'La longitud debe estar entre -180 y 180')
    .max(180, 'La longitud debe estar entre -180 y 180'),
  topic_temperatura: z.string().trim().optional().nullable(),
  topic_humedad: z.string().trim().optional().nullable(),
  topic_aqi: z.string().trim().optional().nullable(),
  topic_ruido: z.string().trim().optional().nullable(),
  topic_ica: z.string().trim().optional().nullable()
}).refine(data => {
  return !!(
    (data.topic_temperatura && data.topic_temperatura.trim() !== '') ||
    (data.topic_humedad && data.topic_humedad.trim() !== '') ||
    (data.topic_aqi && data.topic_aqi.trim() !== '') ||
    (data.topic_ruido && data.topic_ruido.trim() !== '') ||
    (data.topic_ica && data.topic_ica.trim() !== '')
  );
}, {
  message: 'Debe ingresar al menos un tópico de monitoreo (Temperatura, Humedad, Aire, Ruido o Agua)',
  path: ['topic_temperatura']
});

module.exports = { crearSensorMqttSchema };
