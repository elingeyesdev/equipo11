const router = require('express').Router();
const controller = require('./predictions.controller');
const { validate } = require('../../middleware/validate');
const { verificarToken } = require('../auth/auth.middleware');
const {
  trendSchema,
  correlationsSchema,
  scenarioSchema,
  reportSchema
} = require('./predictions.schema');

router.post('/trend', verificarToken, validate(trendSchema, 'body'), controller.getTrend);
router.post('/correlations', verificarToken, validate(correlationsSchema, 'body'), controller.getCorrelations);
router.post('/scenario', verificarToken, validate(scenarioSchema, 'body'), controller.getScenario);
router.post('/report', verificarToken, validate(reportSchema, 'body'), controller.getReport);

module.exports = router;
