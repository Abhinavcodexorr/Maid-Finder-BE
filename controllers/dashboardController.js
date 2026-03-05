const Booking = require('../models/Booking');
const Favourite = require('../models/Favourite');

exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [upcomingBookings, previousBookings, favourites] = await Promise.all([
      Booking.find({ user: userId, status: { $in: ['pending', 'confirmed', 'in_progress'] }, scheduledDate: { $gte: new Date() } })
        .populate('maid', 'fullName email phone imageUrl monthlySalaryAed skills emirate')
        .sort({ scheduledDate: 1 })
        .limit(5),
      Booking.find({ user: userId, status: 'completed' })
        .populate('maid', 'fullName email phone imageUrl monthlySalaryAed skills emirate')
        .sort({ scheduledDate: -1 })
        .limit(10),
      Favourite.find({ user: userId })
        .populate('maid', 'fullName email phone imageUrl monthlySalaryAed skills emirate nationality visaStatus')
        .sort({ createdAt: -1 }),
    ]);
    const favouriteMaids = favourites.map((f) => f.maid);
    res.json({
      success: true,
      data: {
        upcomingBookings,
        previousBookings,
        favouriteMaids,
      },
    });
  } catch (error) {
    next(error);
  }
};
