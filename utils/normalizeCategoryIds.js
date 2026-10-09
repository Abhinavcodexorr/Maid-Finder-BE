// Accepts a real array (from a JSON body), a comma-separated string (from a
// multipart form field or query param, e.g. "cat-maid,cat-cook"), or nothing.
const normalizeCategoryIds = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return undefined;
};

module.exports = normalizeCategoryIds;
