const express = require('express');
const { listPublicPlans } = require('../controllers/planController');
const { subscribe } = require('../controllers/subscriptionController');
const { protectCustomer } = require('../middleware/auth');

const router = express.Router();

router.get('/', listPublicPlans);
router.post('/subscribe', protectCustomer, subscribe);
router.post('/:id/subscribe', protectCustomer, subscribe);

module.exports = router;
