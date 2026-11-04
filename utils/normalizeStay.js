const { STAY_OPTIONS } = require('../config/constants');

// "Live in" / "live-in" / "LIVE_IN" -> "live_in"; accepts an array or a comma-separated string.
// Unknown values are dropped; duplicates removed. Returns [] for nothing valid.
const normalizeStay = (value) => {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const cleaned = list
    .map((v) => String(v).trim().toLowerCase().replace(/[\s-]+/g, '_'))
    .filter((v) => STAY_OPTIONS.includes(v));
  return [...new Set(cleaned)];
};

module.exports = normalizeStay;
