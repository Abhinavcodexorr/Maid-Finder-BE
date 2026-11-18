const { DEFAULT_COUNTRY } = require('../config/countries');

// The country a customer/provider app request is for: `?country=AU`, a `country` body field, or an
// `X-Country` header. Without one it is the default country, so the existing apps keep working unchanged.
const publicCountry = (req) => {
  const raw = (req.query && req.query.country) || (req.body && req.body.country) || req.headers['x-country'] || DEFAULT_COUNTRY;
  return String(Array.isArray(raw) ? raw[0] : raw).trim().toUpperCase() || DEFAULT_COUNTRY;
};

module.exports = publicCountry;
