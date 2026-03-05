module.exports = {
  VISA_STATUS: ['Own Visa', 'Employer Visa', 'Visit Visa', 'No Visa'],
  BOOKING_STATUS: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
  JWT_EXPIRES_IN: '7d',
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // requests per window
};
