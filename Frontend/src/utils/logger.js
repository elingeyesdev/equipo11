export default {
  error: (...args) => console.error('[EnviroSense Error]', ...args),
  warn: (...args) => console.warn('[EnviroSense Warn]', ...args),
  info: (...args) => console.info('[EnviroSense Info]', ...args),
  log: (...args) => console.log('[EnviroSense Log]', ...args),
};
