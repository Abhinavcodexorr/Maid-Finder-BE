const express = require('express');
const { listPublicServices } = require('../controllers/serviceController');

const router = express.Router();

router.get('/', listPublicServices);

module.exports = router;
