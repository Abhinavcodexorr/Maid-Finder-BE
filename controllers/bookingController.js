const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const MESSAGES = require('../config/errorMessages.json');

exports.createBooking = async (req, res, next) => {
  try {
    const { maidId, scheduledDate, startTime, endTime, duration, monthlySalary, address, emirate, notes } = req.body;
    const provider = await Provider.findById(maidId);
    if (!provider) {
      return res.status(404).json({ success: false, message: MESSAGES.booking.providerNotFound });
    }
    const booking = await Booking.create({
      user: req.user._id,
      maid: maidId,
      scheduledDate,
      startTime,
      endTime,
      duration: duration || 1,
      monthlySalary: monthlySalary || provider.monthlySalary,
      address,
      emirate,
      notes,
    });
    await booking.populate('maid', 'fullName email phone imageUrl monthlySalary skills');
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

exports.getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const bookings = await Booking.find(query)
      .populate('maid', 'fullName email phone imageUrl monthlySalary skills emirate')
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await Booking.countDocuments(query);
    res.json({
      success: true,
      count: bookings.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: MESSAGES.booking.notFound });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: MESSAGES.booking.alreadyCancelled });
    }
    booking.status = 'cancelled';
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};
