// allow('providers.approve', 'provider.approve'): lets the request through only if the signed-in admin
// has that permission, and names the action in the audit log.
const hasPermission = (admin, permission) =>
  !!admin && (admin.permissions.includes('*') || admin.permissions.includes(permission));

const allow = (permission, action) => (req, res, next) => {
  if (action) req.auditAction = action;
  if (hasPermission(req.admin, permission)) return next();
  req.auditDenied = `Missing permission: ${permission}`;
  return res.status(403).json({ success: false, code: 'FORBIDDEN', message: "You don't have permission to do this." });
};

// Superadmin only (managing admins).
const superadminOnly = (action) => (req, res, next) => {
  if (action) req.auditAction = action;
  if (req.admin && (req.admin.role === 'superadmin' || req.admin.role === 'system')) return next();
  req.auditDenied = 'Superadmin only';
  return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only a superadmin can do this.' });
};

module.exports = { allow, superadminOnly, hasPermission };
