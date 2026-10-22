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

router.use(adminAuth);

router.get('/dashboard', getAdminDashboard);
router.get('/providers/summary', providersSummary);
router.get('/providers', listProviders);
router.get('/providers/:id', getProvider);
router.patch('/providers/:id/verify', verifyProvider);
router.patch('/providers/:id/approve', approveProvider);
router.patch('/providers/:id/reject', rejectProvider);
router.patch('/providers/:id', updateProvider);
router.delete('/providers/:id', deleteProvider);

router.get('/customers', listCustomers);
router.get('/customers/:id', getCustomer);
router.get('/customers/:id/subscriptions', getCustomerSubscriptionsAdmin);
router.get('/customers/:id/subscription', getCustomerSubscriptionsAdmin);
router.post('/customers/:id/subscriptions', grantSubscription);
router.patch('/customers/:id/subscriptions/:subId/cancel', cancelSubscription);
router.get('/subscriptions', listAllSubscriptionsAdmin);
router.patch('/customers/:id/flag', flagCustomer);
router.post('/customers/:id/notes', addCustomerNote);
router.delete('/customers/:id/notes/:noteId', deleteCustomerNote);
router.patch('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);
router.patch('/customers/:id/activate', activateCustomer);
router.patch('/customers/:id/deactivate', deactivateCustomer);

router.get('/services', listServices);
router.post('/services', createService);
router.patch('/services/:id/activate', activateService);
router.patch('/services/:id/deactivate', deactivateService);
router.patch('/services/:id', updateService);
router.delete('/services/:id', deleteService);

router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id/activate', activatePlan);
router.patch('/plans/:id/deactivate', deactivatePlan);
router.patch('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

module.exports = router;
