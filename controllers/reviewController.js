const mongoose = require('mongoose');
const Review = require('../models/Review');
const Provider = require('../models/Provider');
const Subscription = require('../models/Subscription');

// "Ananya Gupta" -> "Ananya G." — reviewers are never shown with a full name or contact detail.
const publicName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Customer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /providers/:id/reviews — public.
exports.listReviews = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Provider not found.' });
    const providerId = new mongoose.Types.ObjectId(req.params.id);
    const [reviews, stats] = await Promise.all([
      Review.find({ provider: providerId }).sort({ createdAt: -1 }).limit(50).populate('user', 'name').lean(),
      Review.aggregate([
        { $match: { provider: providerId } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);
    const { average = 0, count = 0 } = stats[0] || {};
    res.json({
      success: true,
      count,
      average: count ? Math.round(average * 10) / 10 : null,
      data: reviews.map((r) => ({
        id: r._id,
        rating: r.rating,
        comment: r.comment,
        name: publicName(r.user && r.user.name),
        createdAt: r.createdAt,
        mine: Boolean(req.user && r.user && String(r.user._id) === String(req.user._id)),
      })),
    });
  } catch (error) {
    next(error);
  }
};

// POST /providers/:id/reviews — signed-in customers who have bought a plan.
exports.createReview = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Provider not found.' });
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Choose a rating from 1 to 5.' });
    }
    if (comment.length < 10 || comment.length > 500) {
      return res.status(400).json({ success: false, message: 'Write a review of 10 to 500 characters.' });
    }
    const provider = await Provider.findById(req.params.id).select('_id');
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found.' });

    const bought = await Subscription.exists({ user: req.user._id });
    if (!bought) {
      return res.status(403).json({ success: false, message: 'Only members who have unlocked contact details can write reviews.' });
    }

    const review = await Review.findOneAndUpdate(
      { provider: provider._id, user: req.user._id },
      { rating, comment },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json({
      success: true,
      data: { id: review._id, rating: review.rating, comment: review.comment, name: publicName(req.user.name), createdAt: review.createdAt, mine: true },
    });
  } catch (error) {
    next(error);
  }
};
