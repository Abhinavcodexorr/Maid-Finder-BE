const express = require('express');
const Country = require('../models/Country');

const router = express.Router();

// Public: the countries the apps can be used in.
router.get('/', async (req, res, next) => {
  try {
    const countries = await Country.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ success: true, count: countries.length, data: countries });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
