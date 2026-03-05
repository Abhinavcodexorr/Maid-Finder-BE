const Booking = require('../models/Booking');
const Maid = require('../models/Maid');

exports.createBooking = async (req, res, next) => {
  try {
    const { maidId, scheduledDate, startTime, endTime, duration, monthlySalaryAed, address, emirate, notes } = req.body;
    const maid = await Maid.findById(maidId);
    if (!maid) {
      return res.status(404).json({ success: false, message: 'Maid not found' });
    }
    const booking = await Booking.create({
      user: req.user._id,
      maid: maidId,
      scheduledDate,
      startTime,
      endTime,
      duration: duration || 1,
      monthlySalaryAed: monthlySalaryAed || maid.monthlySalaryAed,
      address,
      emirate,
      notes,
    });
    await booking.populate('maid', 'fullName email phone imageUrl monthlySalaryAed skills');
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
      .populate('maid', 'fullName email phone imageUrl monthlySalaryAed skills emirate')
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
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking already cancelled' });
    }
    booking.status = 'cancelled';
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};
