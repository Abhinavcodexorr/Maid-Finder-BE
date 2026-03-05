const express = require('express');
const { register, login, getMe } = require('../controllers/customerController');
const { getDashboard } = require('../controllers/dashboardController');
const { createBooking, getMyBookings, cancelBooking } = require('../controllers/bookingController');
const { addFavourite, removeFavourite, getMyFavourites } = require('../controllers/favouriteController');
const { protectCustomer } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/me', protectCustomer, getMe);
router.get('/dashboard', protectCustomer, getDashboard);

router.get('/bookings', protectCustomer, getMyBookings);
router.post('/bookings', protectCustomer, createBooking);
router.delete('/bookings/:id', protectCustomer, cancelBooking);

router.get('/favourites', protectCustomer, getMyFavourites);
router.post('/favourites/:maidId', protectCustomer, addFavourite);
router.delete('/favourites/:maidId', protectCustomer, removeFavourite);

module.exports = router;
