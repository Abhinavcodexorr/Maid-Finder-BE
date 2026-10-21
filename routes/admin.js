const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const {
  listProviders,
  providersSummary,
  verifyProvider,
  approveProvider,
  rejectProvider,
  updateProvider,
  deleteProvider,
  listCustomers,
  activateCustomer,
  deactivateCustomer,
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
router.patch('/providers/:id/verify', verifyProvider);
router.patch('/providers/:id/approve', approveProvider);
router.patch('/providers/:id/reject', rejectProvider);
router.patch('/providers/:id', updateProvider);
router.delete('/providers/:id', deleteProvider);

router.get('/customers', listCustomers);
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
