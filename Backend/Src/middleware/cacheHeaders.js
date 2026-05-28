const CACHE_RULES = {
  '/api/historial': 'public, max-age=300, stale-while-revalidate=3600',
  '/api/sensores': 'public, max-age=300, stale-while-revalidate=3600',
  '/api/alertas': 'public, max-age=60, stale-while-revalidate=1800',
};

module.exports = (req, res, next) => {
  const rule = CACHE_RULES[req.path];
  if (rule) res.set('Cache-Control', rule);
  next();
};
