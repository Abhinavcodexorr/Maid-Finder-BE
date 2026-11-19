const express = require('express');
const {
  grantSubscription,
  cancelSubscription,
  listAllSubscriptionsAdmin,
  getCustomerSubscriptionsAdmin,
} = require('../controllers/subscriptionController');
const adminAuth = require('../middleware/adminAuth');
const {
  listProviders,
  providersSummary,
  getProvider,
  verifyProvider,
  approveProvider,
  rejectProvider,
  updateProvider,
  deleteProvider,
  listCustomers,
  activateCustomer,
  deactivateCustomer,
  getCustomer,
  flagCustomer,
  addCustomerNote,
  deleteCustomerNote,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/adminController');

const { getAdminDashboard } = require('../controllers/adminDashboardController');

const {
  listServices,
  createService,
  updateService,
  activateService,
  deactivateService,
  deleteService,
} = require('../controllers/serviceController');

const {
  listPlans,
  createPlan,
  updatePlan,
  activatePlan,
  deactivatePlan,
  deletePlan,
} = require('../controllers/planController');

const router = express.Router();

const adminCountry = require('../middleware/adminCountry');
const adminContext = require('../middleware/adminContext');
const audit = require('../middleware/audit');
const { allow, superadminOnly } = require('../middleware/authorize');
const { me, rbacCatalog, recordEvent, listAuditLogs } = require('../controllers/auditController');
const {
  listCountries,
  verifyAdminLogin,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  changeAdminPassword,
} = require('../controllers/adminUserController');

router.use(adminAuth);
router.use(adminContext);
router.use(audit);

// Not country-specific: who the admins are, which countries exist, who is signed in.
router.get('/countries', listCountries);
router.post('/auth/login', verifyAdminLogin);
router.post('/audit/event', recordEvent);
router.get('/me', me);
router.get('/rbac', rbacCatalog);
router.get('/admins', superadminOnly(), listAdmins);
router.post('/admins', superadminOnly('admin.create'), createAdmin);
router.patch('/admins/:id', superadminOnly('admin.update'), updateAdmin);
router.delete('/admins/:id', superadminOnly('admin.delete'), deleteAdmin);
router.post('/admins/:id/change-password', changeAdminPassword);

// Everything below works inside the country the admin selected (x-admin-country), and only if the
// admin is allowed that country. Each route also needs the permission named in allow().
router.use(adminCountry);

router.get('/audit-logs', allow('logs.view'), listAuditLogs);

router.get('/dashboard', allow('dashboard.view'), getAdminDashboard);
router.get('/providers/summary', allow('providers.view'), providersSummary);
router.get('/providers', allow('providers.view'), listProviders);
router.get('/providers/:id', allow('providers.view', 'provider.view'), getProvider);
router.patch('/providers/:id/verify', allow('providers.verify', 'provider.verify'), verifyProvider);
router.patch('/providers/:id/approve', allow('providers.review', 'provider.approve'), approveProvider);
router.patch('/providers/:id/reject', allow('providers.review', 'provider.reject'), rejectProvider);
router.patch('/providers/:id', allow('providers.edit', 'provider.update'), updateProvider);
router.delete('/providers/:id', allow('providers.delete', 'provider.delete'), deleteProvider);

router.get('/customers', allow('customers.view'), listCustomers);
router.get('/customers/:id', allow('customers.view', 'customer.view'), getCustomer);
router.get('/customers/:id/subscriptions', allow('customers.view'), getCustomerSubscriptionsAdmin);
router.get('/customers/:id/subscription', allow('customers.view'), getCustomerSubscriptionsAdmin);
router.post('/customers/:id/subscriptions', allow('customers.manage', 'subscription.grant'), grantSubscription);
router.patch('/customers/:id/subscriptions/:subId/cancel', allow('customers.manage', 'subscription.cancel'), cancelSubscription);
router.get('/subscriptions', allow('customers.view'), listAllSubscriptionsAdmin);
router.patch('/customers/:id/flag', allow('customers.manage', 'customer.flag'), flagCustomer);
router.post('/customers/:id/notes', allow('customers.manage', 'customer.note_add'), addCustomerNote);
router.delete('/customers/:id/notes/:noteId', allow('customers.manage', 'customer.note_delete'), deleteCustomerNote);
router.patch('/customers/:id/activate', allow('customers.manage', 'customer.activate'), activateCustomer);
router.patch('/customers/:id/deactivate', allow('customers.manage', 'customer.deactivate'), deactivateCustomer);
router.patch('/customers/:id', allow('customers.manage', 'customer.update'), updateCustomer);
router.delete('/customers/:id', allow('customers.delete', 'customer.delete'), deleteCustomer);

router.get('/services', allow('services.view'), listServices);
router.post('/services', allow('services.manage', 'service.create'), createService);
router.patch('/services/:id/activate', allow('services.manage', 'service.activate'), activateService);
router.patch('/services/:id/deactivate', allow('services.manage', 'service.deactivate'), deactivateService);
router.patch('/services/:id', allow('services.manage', 'service.update'), updateService);
router.delete('/services/:id', allow('services.manage', 'service.delete'), deleteService);

router.get('/plans', allow('plans.view'), listPlans);
router.post('/plans', allow('plans.manage', 'plan.create'), createPlan);
router.patch('/plans/:id/activate', allow('plans.manage', 'plan.activate'), activatePlan);
router.patch('/plans/:id/deactivate', allow('plans.manage', 'plan.deactivate'), deactivatePlan);
router.patch('/plans/:id', allow('plans.manage', 'plan.update'), updatePlan);
router.delete('/plans/:id', allow('plans.manage', 'plan.delete'), deletePlan);

module.exports = router;
