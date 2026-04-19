/**
 * Esquemas de validación Zod para el módulo de autenticación.
 * 
 * - Mensajes de error en español para que el Frontend los muestre directamente.
 * - El validador .email() acepta cualquier dominio válido (@est.univalle.edu, @gmail.com, etc.)
 */
const { z } = require('zod')

const registerSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es requerido' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  apellido: z.string({ required_error: 'El apellido es requerido' })
    .trim()
    .min(2, 'El apellido debe tener al menos 2 caracteres')
    .max(100, 'El apellido no puede exceder 100 caracteres'),
  email: z.string({ required_error: 'El correo es requerido' })
    .email('Debe ser un correo electrónico válido')
    .max(150, 'El correo no puede exceder 150 caracteres'),
  password: z.string({ required_error: 'La contraseña es requerida' })
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

const loginSchema = z.object({
  email: z.string({ required_error: 'El correo es requerido' })
    .email('Debe ser un correo electrónico válido'),
  password: z.string({ required_error: 'La contraseña es requerida' })
    .min(1, 'La contraseña es requerida'),
})

module.exports = { registerSchema, loginSchema }
