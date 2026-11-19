const AuditLog = require('../models/AuditLog');

const SECRET_KEY = /pass|token|secret|otp|authorization|api[-_]?key/i;
const MAX_STRING = 300;
const MAX_JSON = 6000;

// Copy of a value that is safe and small enough to store: secrets removed, long text cut.
const sanitize = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (depth > 4) return '[nested]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEY.test(k) ? '[hidden]' : sanitize(v, depth + 1);
  }
  return out;
};

const capped = (value) => {
  const clean = sanitize(value);
  if (clean === undefined) return undefined;
  try {
    if (JSON.stringify(clean).length > MAX_JSON) return { note: 'Too large to store', keys: Object.keys(clean || {}) };
  } catch {
    return undefined;
  }
  return clean;
};

// Never throws: a logging problem must not break (or hide) the action itself.
const writeAudit = async (entry) => {
  try {
    await AuditLog.create({
      ...entry,
      changes: capped(entry.changes),
      details: capped(entry.details),
      message: entry.message ? String(entry.message).slice(0, 300) : undefined,
    });
  } catch (error) {
    console.error('[audit] could not write log:', error.message);
  }
};

module.exports = { writeAudit, sanitize, capped };
