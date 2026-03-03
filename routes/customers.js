const express = require('express');
const { register, login, getMe } = require('../controllers/customerController');
const { protectCustomer } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protectCustomer, getMe);

module.exports = router;
