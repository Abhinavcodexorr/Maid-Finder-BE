const AdminUser = require('../models/AdminUser');
const { effectivePermissions } = require('../config/permissions');

// Works out WHO is calling the admin API. The panel sends the signed-in admin as x-admin-* headers
// (it holds the API key, so they can be trusted). For admins created in the Admins page we do not
// trust the panel's copy of their rights: role, permissions, countries and "still active" are read
// from the database, so removing someone's access takes effect on their very next request.
// A call with only the API key (scripts) has no identity and is treated as a system call.
const cache = new Map(); // adminId -> { at, admin }
const TTL_MS = 10_000;

const invalidateAdmin = (id) => {
  if (id) cache.delete(String(id));
};

const loadAdmin = async (id) => {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.admin;
  const admin = await AdminUser.findById(id).lean().catch(() => null);
  cache.set(id, { at: Date.now(), admin });
  return admin;
};

const decode = (v) => {
  if (!v) return '';
  try {
    return decodeURIComponent(String(v));
  } catch {
    return String(v);
  }
};

const adminContext = async (req, res, next) => {
  try {
    const h = req.headers;
    const email = decode(h['x-admin-email']).trim().toLowerCase();
    const base = {
      // The panel passes the admin's own address; req.ip would only be the panel server's.
      ip: String(h['x-admin-ip'] || (h['x-admin-email'] ? '' : req.ip) || '').slice(0, 64),
      userAgent: String(h['x-admin-ua'] || h['user-agent'] || '').slice(0, 300),
    };

    if (!email) {
      req.admin = { ...base, id: null, email: 'api-key', name: 'API key', role: 'system', source: 'api-key', permissions: ['*'], countries: ['*'] };
      return next();
    }

    const source = h['x-admin-source'] === 'db' ? 'db' : 'env';
    if (source === 'db') {
      const id = String(h['x-admin-id'] || '');
      const admin = id ? await loadAdmin(id) : null;
      if (!admin || !admin.isActive) {
        return res.status(401).json({ success: false, code: 'ADMIN_INACTIVE', message: 'This account is disabled or no longer exists.' });
      }
      req.admin = {
        ...base,
        id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        source,
        permissions: effectivePermissions(admin),
        countries: admin.role === 'superadmin' ? ['*'] : admin.countries || [],
      };
      return next();
    }

    // The owner account from the panel's environment settings: always a superadmin.
    req.admin = { ...base, id: null, email, name: decode(h['x-admin-name']) || email, role: 'superadmin', source, permissions: ['*'], countries: ['*'] };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = adminContext;
module.exports.invalidateAdmin = invalidateAdmin;
