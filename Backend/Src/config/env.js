/**
 * Validación de variables de entorno requeridas al arranque.
 * 
 * SRP: solo valida — no carga dotenv (eso lo hace index.js).
 * Debe importarse DESPUÉS de require('dotenv').config().
 */

const required = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'CORS_ORIGIN',
];

const optional = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'TELEGRAM_TOKEN',
];

const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('FATAL: Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const warnings = optional.filter(k => !process.env[k]);
if (warnings.length > 0) {
  console.warn('WARNING: Missing optional environment variables:', warnings.join(', '));
}

if (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN === '*') {
  console.error('FATAL: CORS_ORIGIN cannot be "*" in production');
  process.exit(1);
}
