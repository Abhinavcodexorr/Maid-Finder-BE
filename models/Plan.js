const mongoose = require('mongoose');

// A membership tier shown on the customer-facing pricing page. Plans are
// admin-managed (create/edit/activate/deactivate/delete via /api/v1/admin/plans)
// and the public pricing page only ever sees the active ones, sorted the way
// the admin ordered them.
const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      minlength: [2, 'Plan name must be at least 2 characters'],
      maxlength: [60, 'Plan name cannot exceed 60 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    // Optional "was ₹X" struck-through price for a discount presentation.
    // Must be strictly greater than `price` when present — enforced below.
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
    },
    durationDays: {
      type: Number,
      required: [true, 'Duration (in days) is required'],
      min: [1, 'Duration must be at least 1 day'],
    },
    features: {
      type: [String],
      default: [],
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Lower sorts first on the public pricing page.
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

planSchema.pre('validate', function (next) {
  if (this.originalPrice !== undefined && this.originalPrice !== null && this.originalPrice <= this.price) {
    return next(new Error('Original price must be greater than price'));
  }
  next();
});

planSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Plan', planSchema, 'plans');
