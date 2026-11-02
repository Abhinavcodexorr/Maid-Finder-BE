const Subscription = require('../models/Subscription');

// Identity documents and ID numbers are never part of the public API — only the admin panel
// (its own /admin/providers routes) and the provider's own /providers/me see them.
const NEVER_PUBLIC = [
  'password',
  'panNumber', 'panCardUrl',
  'aadhaarNumber', 'aadhaarFrontUrl', 'aadhaarBackUrl',
  'passportFrontUrl', 'passportUrl', 'otherIdProofUrl', 'otherIdProof',
  'kycDocuments',
  'mobileNumberDigits',
  'dateOfBirth',
  'rejectionReason',
];

// Contact details are returned only to a logged-in customer who has an active (paid, not
// cancelled, not expired) subscription.
const MEMBERS_ONLY = ['mobileNumber', 'countryCode', 'phone', 'whatsappNumber', 'whatsapp', 'email'];

// True when `req.user` (set by optionalProtect) is a customer with a running subscription.
const viewerHasActivePlan = async (req) => {
  if (!req.user) return false;
  const now = new Date();
  const sub = await Subscription.findOne({
    user: req.user._id,
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
    $or: [{ cancelledAt: { $exists: false } }, { cancelledAt: null }],
  })
    .select('_id')
    .lean();
  return Boolean(sub);
};

// Returns a plain copy of one provider with the private fields removed.
const sanitizeProvider = (provider, isMember) => {
  if (!provider) return provider;
  const copy = typeof provider.toObject === 'function' ? provider.toObject() : { ...provider };
  NEVER_PUBLIC.forEach((key) => delete copy[key]);
  if (!isMember) MEMBERS_ONLY.forEach((key) => delete copy[key]);
  return copy;
};

module.exports = { viewerHasActivePlan, sanitizeProvider, NEVER_PUBLIC, MEMBERS_ONLY };
