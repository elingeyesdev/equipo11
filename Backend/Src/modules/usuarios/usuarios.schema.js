/**
 * Esquemas de validación Zod para el módulo de usuarios.
 * 
 * - Mensajes de error en español para mostrar directamente en el Frontend.
 */
const { z } = require('zod');

const updateRolSchema = z.object({
  rol_id: z.number({ required_error: 'El ID de rol es requerido' })
    .int('El ID de rol debe ser un número entero')
    .positive('El ID de rol debe ser positivo')
});

const updateEstadoSchema = z.object({
  activo: z.boolean({ required_error: 'El estado activo es requerido' })
});

const updatePreferenciasSchema = z.object({
  latitud: z.union([z.number(), z.string(), z.null()]).optional(),
  longitud: z.union([z.number(), z.string(), z.null()]).optional(),
  notif_email: z.boolean().optional().default(false),
  notif_whatsapp: z.boolean().optional().default(false),
  whatsapp_destino: z.string()
    .trim()
    .max(50, 'El destino de WhatsApp no puede exceder 50 caracteres')
    .nullable()
    .optional(),
  notif_telegram: z.boolean().optional().default(false),
  telegram_destino: z.string()
    .trim()
    .max(50, 'El destino de Telegram no puede exceder 50 caracteres')
    .nullable()
    .optional()
});

module.exports = {
  updateRolSchema,
  updateEstadoSchema,
  updatePreferenciasSchema
};
