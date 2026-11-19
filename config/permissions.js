// Role-based access control for the admin panel.
//
// A superadmin can do everything in every country. A subadmin works only in the countries they were
// given and can only do what their permissions allow. "admins.manage" (creating admins, changing roles
// and countries) is never grantable: it belongs to superadmins only.

const PERMISSIONS = [
  { key: 'dashboard.view', group: 'Dashboard', label: 'View the dashboard' },
  { key: 'providers.view', group: 'Providers', label: 'View providers and their details' },
  { key: 'providers.verify', group: 'Providers', label: 'Start verification of new requests' },
  { key: 'providers.review', group: 'Providers', label: 'Approve or reject providers' },
  { key: 'providers.edit', group: 'Providers', label: 'Edit provider details' },
  { key: 'providers.delete', group: 'Providers', label: 'Delete providers' },
  { key: 'customers.view', group: 'Customers', label: 'View customers and subscriptions' },
  { key: 'customers.manage', group: 'Customers', label: 'Edit, flag, add notes, activate or deactivate, manage subscriptions' },
  { key: 'customers.delete', group: 'Customers', label: 'Delete customers' },
  { key: 'services.view', group: 'Services', label: 'View services' },
  { key: 'services.manage', group: 'Services', label: 'Create, edit and delete services' },
  { key: 'plans.view', group: 'Plans', label: 'View plans' },
  { key: 'plans.manage', group: 'Plans', label: 'Create, edit and delete plans' },
  { key: 'logs.view', group: 'Audit', label: 'View the audit log' },
];

const KEYS = PERMISSIONS.map((p) => p.key);
const without = (...drop) => KEYS.filter((k) => !drop.includes(k));

// Ready-made sets the Admins page offers; "custom" lets a superadmin tick exactly what they want.
const ROLE_TEMPLATES = {
  manager: {
    label: 'Manager',
    description: 'Everything day to day, in their countries. No audit log.',
    permissions: without('logs.view'),
  },
  verifier: {
    label: 'Verifier',
    description: 'Reviews providers: view, verify, approve or reject, edit. Cannot delete.',
    permissions: ['dashboard.view', 'providers.view', 'providers.verify', 'providers.review', 'providers.edit', 'services.view'],
  },
  support: {
    label: 'Support',
    description: 'Looks things up and manages customers. Cannot approve providers or change services and plans.',
    permissions: ['dashboard.view', 'providers.view', 'customers.view', 'customers.manage', 'services.view', 'plans.view'],
  },
  viewer: {
    label: 'View only',
    description: 'Can look but not change anything.',
    permissions: ['dashboard.view', 'providers.view', 'customers.view', 'services.view', 'plans.view'],
  },
};

// Admins saved before permissions existed keep what they could always do.
const LEGACY_DEFAULT = ROLE_TEMPLATES.manager.permissions;

const cleanPermissions = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((p) => String(p).trim()).filter((p) => KEYS.includes(p)))];
};

// What an admin document may actually do: ['*'] for a superadmin.
const effectivePermissions = (admin) => {
  if (admin.role === 'superadmin') return ['*'];
  return Array.isArray(admin.permissions) ? cleanPermissions(admin.permissions) : LEGACY_DEFAULT;
};

const effectiveTemplate = (admin) => {
  if (admin.role === 'superadmin') return 'superadmin';
  if (admin.roleTemplate) return admin.roleTemplate;
  return Array.isArray(admin.permissions) ? 'custom' : 'manager';
};

module.exports = { PERMISSIONS, KEYS, ROLE_TEMPLATES, cleanPermissions, effectivePermissions, effectiveTemplate };
