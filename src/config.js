'use strict';
const path = require('path');

const num = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  PORT: num(process.env.PORT, 3000),
  IS_PROD: process.env.NODE_ENV === 'production',
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),

  VIEWPORT_W: 390,
  VIEWPORT_H: 844,
  DEVICE_SCALE: 2,

  MAX_SHOT_HEIGHT: num(process.env.MAX_SHOT_HEIGHT, 2500),
  CONCURRENCY: num(process.env.CONCURRENCY, 1),
  JOB_TIMEOUT_MS: num(process.env.JOB_TIMEOUT_MS, 75000),
  CACHE_TTL_MS: num(process.env.CACHE_TTL_HOURS, 24) * 60 * 60 * 1000,
  RATE_LIMIT_PER_HOUR: num(process.env.RATE_LIMIT_PER_HOUR, 10),

  USER_AGENT:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
};
