const mongoose = require('mongoose');

// A plan a customer bought. The plan's name, price and length are copied in at purchase time, so later
// edits to (or deletion of) the Plan never change what a customer actually paid for.
const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    planName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    // Only "cancelled" is stored; "active" / "upcoming" / "expired" are worked out from the dates.
    cancelledAt: { type: Date },
    // Payment gateway reference, when the app sends one.
    paymentRef: { type: String, trim: true, maxlength: 120 },
    source: { type: String, enum: ['app', 'admin'], default: 'app' },
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1, startsAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema, 'subscriptions');
