const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const { listProviders, providersSummary, verifyProvider, approveProvider, rejectProvider, updateProvider, deleteProvider } = require('../controllers/adminController');

const router = express.Router();

router.use(adminAuth);

router.get('/providers/summary', providersSummary);
router.get('/providers', listProviders);
router.patch('/providers/:id/verify', verifyProvider);
router.patch('/providers/:id/approve', approveProvider);
router.patch('/providers/:id/reject', rejectProvider);
router.patch('/providers/:id', updateProvider);
router.delete('/providers/:id', deleteProvider);

module.exports = router;
