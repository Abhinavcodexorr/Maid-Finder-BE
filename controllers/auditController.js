const AuditLog = require('../models/AuditLog');
const AdminUser = require('../models/AdminUser');
const Country = require('../models/Country');
const { writeAudit } = require('../utils/auditLog');
const { PERMISSIONS, ROLE_TEMPLATES, effectivePermissions, effectiveTemplate } = require('../config/permissions');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /admin/me: the signed-in admin as the database sees them right now (the panel polls this so a
// change of permissions or countries shows up without signing in again).
exports.me = async (req, res, next) => {
  try {
    const a = req.admin;
    let countries = a.countries;
    if (countries.includes('*')) {
      countries = (await Country.find({ isActive: true }).select('code').lean()).map((c) => c.code);
    } else {
      const active = new Set((await Country.find({ isActive: true }).select('code').lean()).map((c) => c.code));
      countries = countries.filter((c) => active.has(c));
    }
    let template = a.role === 'superadmin' || a.role === 'system' ? 'superadmin' : 'manager';
    if (a.id) {
      const doc = await AdminUser.findById(a.id).lean();
      if (doc) template = effectiveTemplate(doc);
    }
    res.json({ success: true, data: { email: a.email, name: a.name, role: a.role, template, permissions: a.permissions, countries } });
  } catch (error) {
    next(error);
  }
};

// GET /admin/rbac: the permissions that exist and the ready-made roles (for the Admins page).
exports.rbacCatalog = (req, res) => {
  res.json({
    success: true,
    data: {
      permissions: PERMISSIONS,
      templates: Object.entries(ROLE_TEMPLATES).map(([key, t]) => ({ key, label: t.label, description: t.description, permissions: t.permissions })),
    },
  });
};

// POST /admin/audit/event: the panel reports sign-ins, sign-outs, country switches and the like,
// which never reach the backend as ordinary admin calls.
const EVENTS = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.logout': 'Signed out',
  'auth.sign_out_everywhere': 'Signed out of every device',
  'auth.country_switch': 'Switched country',
  'auth.password_changed': 'Changed own password',
  'auth.session_revoked': 'Session ended (account disabled or removed)',
};
exports.recordEvent = async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!EVENTS[b.type]) return res.status(400).json({ success: false, message: 'Unknown event.' });
    await writeAudit({
      actor: { adminId: b.adminId, email: String(b.email || '').toLowerCase(), name: b.name, role: b.role, source: b.source },
      action: b.type,
      resource: 'auth',
      country: b.country ? String(b.country).toUpperCase() : undefined,
      method: 'POST',
      path: '/panel/auth',
      status: b.success === false ? 401 : 200,
      success: b.success !== false,
      message: b.message || EVENTS[b.type],
      details: b.details,
      ip: String(b.ip || '').slice(0, 64),
      userAgent: String(b.userAgent || '').slice(0, 300),
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// GET /admin/audit-logs: filters q, actor (email), action, resource, country, success, from, to, page, limit.
exports.listAuditLogs = async (req, res, next) => {
  try {
    const { q, actor, action, resource, country, success, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const and = [];
    // A subadmin sees only the countries they work in (and nothing that has no country).
    if (!req.admin.countries.includes('*')) {
      and.push({ country: { $in: req.admin.countries } });
      and.push({ resource: { $ne: 'admin' } });
    } else if (country) {
      and.push({ country: String(country).toUpperCase() });
    }
    if (!req.admin.countries.includes('*') && country && req.admin.countries.includes(String(country).toUpperCase())) {
      and.push({ country: String(country).toUpperCase() });
    }
    if (actor) and.push({ 'actor.email': String(actor).toLowerCase() });
    if (action) and.push({ action: new RegExp(`^${escapeRegex(action)}`) });
    if (resource) and.push({ resource: String(resource) });
    if (success === 'true') and.push({ success: true });
    if (success === 'false') and.push({ success: false });
    const range = {};
    if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(to);
    if (Object.keys(range).length) and.push({ at: range });
    if (q) {
      const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
      and.push({ $or: [{ 'actor.email': rx }, { 'actor.name': rx }, { resourceLabel: rx }, { resourceId: rx }, { action: rx }, { message: rx }, { ip: rx }] });
    }
    const filter = and.length ? { $and: and } : {};

    const [data, total, actors, actions] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct('actor.email', and.length ? { $and: and.filter((c) => !c['actor.email']) } : {}),
      AuditLog.distinct('action', and.length ? { $and: and.filter((c) => !c.action) } : {}),
    ]);

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      facets: { actors: actors.filter(Boolean).sort(), actions: actions.filter(Boolean).sort() },
      data: data.map(({ _id, ...rest }) => ({ id: _id, ...rest })),
    });
  } catch (error) {
    next(error);
  }
};
