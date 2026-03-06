module.exports = {
  VISA_STATUS: ['Own Visa', 'Employer Visa', 'Visit Visa', 'No Visa'],
  MARITAL_STATUS: ['Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'],
  PREFERRED_JOB: [
    'Live In Maid', 'Live Out Maid', 'Assist In Kitchen / Basic Cook', 'Cooking Skills',
    'Nanny-child Care', 'New Born', 'Private Tutor', 'Pet Care - Maid', 'Elderly Care',
    'Special Needs Care', 'Private Nurse', 'Driving Experience',
  ],
  DURATION_OPTIONS: ['Part-time', 'Full-time', 'Flexible'],
  BOOKING_STATUS: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
  JWT_EXPIRES_IN: '7d',
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // requests per window
};
