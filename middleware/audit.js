const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Service = require('../models/Service');
const Plan = require('../models/Plan');
const AdminUser = require('../models/AdminUser');
const { writeAudit, sanitize } = require('../utils/auditLog');

// Records every change an admin makes (and anything refused) to the audit log.
// - Writes (POST/PATCH/PUT/DELETE) are always logged, with who, where, what, and for edits the
//   before/after of every field that changed.
// - Reads are logged only for a few actions that expose personal data (set with allow(..., 'x.view')),
//   plus any refused request (403/401).
const MODELS = { providers: Provider, customers: User, services: Service, plans: Plan, admins: AdminUser };
const RESOURCE = { providers: 'provider', customers: 'customer', services: 'service', plans: 'plan', admins: 'admin', subscriptions: 'subscription' };
const SKIP_DIFF = /pass|token|secret|otp/i;

const labelOf = (doc) => (doc ? doc.fullName || doc.name || doc.title || doc.email || doc.mobileNumber || doc.phone : undefined);

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const diff = (before, body) => {
  if (!before || !body || typeof body !== 'object') return undefined;
  const out = {};
  for (const [key, to] of Object.entries(body)) {
    if (SKIP_DIFF.test(key)) {
      out[key] = { from: '[hidden]', to: '[hidden]' };
      continue;
    }
    const from = before[key];
    if (to && typeof to === 'object' && !Array.isArray(to) && from && typeof from === 'object') {
      // one level of nesting (e.g. lastWorkingExperience)
      for (const [k2, to2] of Object.entries(to)) {
        if (!same(from[k2], to2)) out[`${key}.${k2}`] = { from: sanitize(from[k2]), to: sanitize(to2) };
      }
    } else if (!same(from, to)) {
      out[key] = { from: sanitize(from), to: sanitize(to) };
    }
  }
  return Object.keys(out).length ? out : undefined;
};

const audit = async (req, res, next) => {
  try {
    // The panel's own sign-in bookkeeping is logged by the panel (with the right person and device).
    if (req.path.startsWith('/audit/event') || req.path === '/auth/login') return next();
    const match = req.path.match(/^\/(providers|customers|services|plans|admins|subscriptions)(?:\/([a-f0-9]{24}))?/i);
    const segment = match ? match[1].toLowerCase() : null;
    const resourceId = match && match[2] ? match[2] : undefined;
    const isWrite = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';

    let before;
    let label;
    if (isWrite && resourceId && segment && MODELS[segment] && mongoose.isValidObjectId(resourceId)) {
      before = await MODELS[segment].findById(resourceId).lean().catch(() => null);
      label = labelOf(before);
    }

    let responseBody;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      const refused = res.statusCode === 401 || res.statusCode === 403;
      const wanted = isWrite || refused || (req.auditAction && req.auditAction.endsWith('.view'));
      if (!wanted || !req.admin) return;

      const data = responseBody && responseBody.data;
      const success = res.statusCode < 400;
      const action = refused ? 'access.denied' : req.auditAction || `${req.method.toLowerCase()}.${req.path}`;
      const entry = {
        actor: { adminId: req.admin.id || undefined, email: req.admin.email, name: req.admin.name, role: req.admin.role, source: req.admin.source },
        action,
        resource: segment ? RESOURCE[segment] : undefined,
        resourceId,
        resourceLabel: label || labelOf(data) || (data && data.email),
        country: req.country,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        success,
        message: success ? undefined : req.auditDenied || (responseBody && responseBody.message),
        ip: req.admin.ip,
        userAgent: req.admin.userAgent,
      };
      if (refused && req.auditAction) entry.details = { attempted: req.auditAction };
      if (success && isWrite) {
        const plainUpdate = req.method === 'PATCH' && /^\/\w+\/[a-f0-9]{24}\/?$/i.test(req.path);
        if (plainUpdate && before) entry.changes = diff(before, req.body);
        else if (req.method !== 'DELETE') {
          entry.details = { ...(req.body && typeof req.body === 'object' ? req.body : {}) };
          if (before && before.applicationStatus) entry.details.previousStatus = before.applicationStatus;
        }
        if (req.method === 'DELETE' && before) entry.details = { removed: labelOf(before) };
      }
      writeAudit(entry);
    });
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = audit;
