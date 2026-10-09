const mongoose = require('mongoose');
const { BOOKING_STATUS } = require('../config/constants');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Field key stays `maid` (not renamed to `provider`) so existing booking
    // documents in the live DB aren't orphaned — only the model it
    // references changed, since the Maid model is now named Provider.
    maid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number,
      default: 1,
    },
    monthlySalaryAed: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: BOOKING_STATUS,
      default: 'pending',
    },
    address: {
      type: String,
      trim: true,
    },
    emirate: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bookingSchema.index({ user: 1 });
bookingSchema.index({ maid: 1 });
bookingSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
