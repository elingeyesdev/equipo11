const METRIC_LIMITS = {
  temperatura:      { min: -40, max: 60 },
  aqi:              { min: 0,   max: 500 },
  ica:              { min: 0,   max: 100 },
  ruido:            { min: 0,   max: 140 },
  humedad:          { min: 0,   max: 100 },
};

const METRIC_KEYS = Object.keys(METRIC_LIMITS);

module.exports = { METRIC_LIMITS, METRIC_KEYS };
