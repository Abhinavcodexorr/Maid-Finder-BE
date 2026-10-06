const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const { listMaids, approveMaid, rejectMaid } = require('../controllers/adminController');

const router = express.Router();

router.use(adminAuth);

router.get('/maids', listMaids);
router.patch('/maids/:id/approve', approveMaid);
router.patch('/maids/:id/reject', rejectMaid);

module.exports = router;
