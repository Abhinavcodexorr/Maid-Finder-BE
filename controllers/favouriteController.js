const Favourite = require('../models/Favourite');
const Maid = require('../models/Maid');

exports.addFavourite = async (req, res, next) => {
  try {
    const maid = await Maid.findById(req.params.maidId);
    if (!maid) {
      return res.status(404).json({ success: false, message: 'Maid not found' });
    }
    const existing = await Favourite.findOne({ user: req.user._id, maid: req.params.maidId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Maid already in favourites' });
    }
    const favourite = await Favourite.create({
      user: req.user._id,
      maid: req.params.maidId,
    });
    await favourite.populate('maid', 'fullName email phone imageUrl monthlySalaryAed skills emirate');
    res.status(201).json({ success: true, data: favourite });
  } catch (error) {
    next(error);
  }
};

exports.removeFavourite = async (req, res, next) => {
  try {
    const result = await Favourite.findOneAndDelete({
      user: req.user._id,
      maid: req.params.maidId,
    });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Favourite not found' });
    }
    res.json({ success: true, message: 'Removed from favourites' });
  } catch (error) {
    next(error);
  }
};

exports.getMyFavourites = async (req, res, next) => {
  try {
    const favourites = await Favourite.find({ user: req.user._id })
      .populate('maid', 'fullName email phone imageUrl monthlySalaryAed skills emirate nationality visaStatus')
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      count: favourites.length,
      data: favourites.map((f) => f.maid),
    });
  } catch (error) {
    next(error);
  }
};
