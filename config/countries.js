// The countries the platform runs in. Each admin works inside one country at a time, and
// providers, customers, services and plans all belong to exactly one of them.
const DEFAULT_COUNTRY = 'IN';

const COUNTRIES = [
  { code: 'IN', name: 'India', currencyCode: 'INR', currencySymbol: '₹', dialCode: '+91', timezone: 'Asia/Kolkata', locale: 'en-IN', sortOrder: 1 },
  { code: 'AU', name: 'Australia', currencyCode: 'AUD', currencySymbol: '$', dialCode: '+61', timezone: 'Australia/Sydney', locale: 'en-AU', sortOrder: 2 },
];

module.exports = { DEFAULT_COUNTRY, COUNTRIES };
