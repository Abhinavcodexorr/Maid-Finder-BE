const express = require('express');
const maidRoutes = require('./maids');
const userRoutes = require('./customers');
const uploadRoutes = require('./upload');
const { logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Maid Finder API is running', timestamp: new Date().toISOString() });
});

router.post('/logout', protect, logout);
router.use('/upload', uploadRoutes);
router.use('/maids', maidRoutes);
router.use('/user', userRoutes);

module.exports = router;
