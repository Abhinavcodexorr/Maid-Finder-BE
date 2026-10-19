const mongoose = require('mongoose');

// One in-flight OTP per phone number. Deliberately separate from Provider —
// an OTP can be requested before any provider account exists (first-time
// signup), and this collection's whole job is to go away once real SMS
// sending replaces the static dev-mode code.
const otpRequestSchema = new mongoose.Schema({
  mobileNumberDigits: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  sentAt: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('OtpRequest', otpRequestSchema);
