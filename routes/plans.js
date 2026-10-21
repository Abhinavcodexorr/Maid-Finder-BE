const express = require('express');
const { listPublicPlans } = require('../controllers/planController');

const router = express.Router();

router.get('/', listPublicPlans);

module.exports = router;
