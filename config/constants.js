module.exports = {
  VISA_STATUS: ['Own Visa', 'Employer Visa', 'Visit Visa', 'No Visa'],
  MARITAL_STATUS: ['Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'],
  PREFERRED_JOB: [
    'Live In Maid', 'Live Out Maid', 'Assist In Kitchen / Basic Cook', 'Cooking Skills',
    'Nanny-child Care', 'New Born', 'Private Tutor', 'Pet Care - Maid', 'Elderly Care',
    'Special Needs Care', 'Private Nurse', 'Driving Experience',
  ],
  DURATION_OPTIONS: ['Part-time', 'Full-time', 'Flexible'],
  // Review pipeline for provider applications, in order: a new application is
  // 'pending', an admin moves it to 'verification', then approves or rejects it.
  APPLICATION_STATUS: ['pending', 'verification', 'approved', 'rejected'],
  // Icon keys an admin can pick for a service; clients map them to their own glyphs.
  SERVICE_ICONS: [
    'sparkles', 'chef-hat', 'wrench', 'zap', 'baby', 'car', 'flower', 'spray-can', 'droplets',
    'paint-roller', 'hammer', 'heart-pulse', 'paw-print', 'shirt', 'home', 'graduation-cap',
    'stethoscope', 'shield-check',
  ],
  BOOKING_STATUS: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
  JWT_EXPIRES_IN: '7d',
  OTP_EXPIRY_MS: 10 * 60 * 1000, // 10 minutes
  OTP_RESEND_COOLDOWN_MS: 60 * 1000, // 1 minute between resend requests
};
