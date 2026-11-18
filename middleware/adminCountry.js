const Country = require('../models/Country');
const { DEFAULT_COUNTRY } = require('../config/countries');

// Which country the admin is working in, sent by the admin panel as `x-admin-country`
// (the panel only sends one the signed-in admin is allowed to use). Without the header the
// default country is used, so older scripts that call the admin API keep working.
let cache = { at: 0, codes: new Set() };

const activeCodes = async () => {
  if (Date.now() - cache.at < 30_000 && cache.codes.size) return cache.codes;
  const countries = await Country.find({ isActive: true }).select('code').lean();
  cache = { at: Date.now(), codes: new Set(countries.map((c) => c.code)) };
  return cache.codes;
};

const adminCountry = async (req, res, next) => {
  try {
    const raw = String(req.headers['x-admin-country'] || DEFAULT_COUNTRY).trim().toUpperCase();
    if (!(await activeCodes()).has(raw)) {
      return res.status(400).json({ success: false, message: 'Unknown or inactive country' });
    }
    req.country = raw;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = adminCountry;
