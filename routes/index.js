const express = require('express');
const providerRoutes = require('./providers');
const userRoutes = require('./customers');
const uploadRoutes = require('./upload');
const adminRoutes = require('./admin');
const { logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const MESSAGES = require('../config/errorMessages.json');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: MESSAGES.generic.healthOk, timestamp: new Date().toISOString() });
});

router.post('/logout', protect, logout);
router.use('/upload', uploadRoutes);
router.use('/providers', providerRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
