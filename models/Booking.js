const mongoose = require('mongoose');
const { BOOKING_STATUS } = require('../config/constants');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    maid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Maid',
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
