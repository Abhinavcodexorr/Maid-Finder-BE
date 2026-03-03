const express = require('express');
const maidRoutes = require('./maids');
const userRoutes = require('./customers');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Maid Finder API is running', timestamp: new Date().toISOString() });
});

router.use('/maids', maidRoutes);
router.use('/user', userRoutes);

module.exports = router;
