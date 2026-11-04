const mongoose = require('mongoose');

// A customer's rating and written review of one professional. One review per customer per professional;
// posting again edits the earlier one.
const reviewSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
  },
  { timestamps: true }
);

reviewSchema.index({ provider: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
