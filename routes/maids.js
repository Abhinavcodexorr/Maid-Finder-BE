const express = require('express');
const { register, login, getMe, listMaids, getMaidById, updateMaid } = require('../controllers/maidController');
const { protectMaid } = require('../middleware/auth');

const router = express.Router();

router.get('/list', listMaids);
router.get('/me', protectMaid, getMe);
router.get('/:id', getMaidById);
router.post('/register', register);
router.post('/login', login);
router.put('/:id', protectMaid, updateMaid);

module.exports = router;
