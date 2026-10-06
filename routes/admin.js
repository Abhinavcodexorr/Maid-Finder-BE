const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const { listMaids, approveMaid, rejectMaid, updateMaid, deleteMaid } = require('../controllers/adminController');

const router = express.Router();

router.use(adminAuth);

router.get('/maids', listMaids);
router.patch('/maids/:id/approve', approveMaid);
router.patch('/maids/:id/reject', rejectMaid);
router.patch('/maids/:id', updateMaid);
router.delete('/maids/:id', deleteMaid);

module.exports = router;
