const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MARITAL_STATUS, APPLICATION_STATUS } = require('../config/constants');

const providerSchema = new mongoose.Schema(
  {
    // Not required at account-creation time anymore — mobile-OTP signup
    // creates the account before email is collected (Basic Details step),
    // so this must be sparse or the 2nd account with no email would
    // collide with the 1st on the unique index (both "null").
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    gender: {
      type: String,
      trim: true,
      enum: ['Male', 'Female'],
    },
    nationality: {
      type: String,
      trim: true,
    },
    // A provider can offer more than one service (e.g. both Babysitter and
    // Maid), so this is an array even though the registration form today
    // only lets someone pick one at signup time.
    categoryIds: {
      type: [String],
      default: [],
    },
    area: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    // Local number only (no country code) — e.g. "9876543210", not
    // "+919876543210". Kept separate from countryCode so the UI can show
    // them as two fields ("+91" | "98765 XXXXX") without re-parsing.
    mobileNumber: {
      type: String,
      trim: true,
    },
    countryCode: {
      type: String,
      trim: true,
      default: '+91',
    },
    // Digits-only copy of mobileNumber ALONE (country code deliberately
    // excluded), kept in sync in the pre-save hook below — this is what
    // OTP send/verify and phone login match against. Every account
    // already in production has this computed without a country code
    // (e.g. mobileNumber "8283941127" -> digits "8283941127", not
    // "918283941127"), so mixing countryCode into this key would silently
    // break phone login for every existing provider on their next save.
    // countryCode is stored only for display/SMS-sending.
    mobileNumberDigits: {
      type: String,
      index: true,
    },
    whatsappNumber: {
      type: String,
      trim: true,
    },
    emirate: {
      type: String,
      trim: true,
    },
    experienceYears: {
      type: Number,
      min: [0, 'Experience cannot be negative'],
    },
    monthlySalary: {
      type: Number,
      min: [0, 'Salary cannot be negative'],
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    imageUrl: {
      type: String,
    },
    phone: {
      type: String,
      trim: true,
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    // Canonical field going forward (Basic Details step collects this, not
    // a raw age number). `age` is kept in sync from it in the pre-save hook
    // below purely so existing code/consumers that already read `age`
    // (admin listing, filters) keep working without every call site
    // needing to switch to computing it from a date themselves.
    dateOfBirth: {
      type: Date,
    },
    age: {
      type: Number,
      min: [18, 'Must be at least 18 years old'],
      max: [100, 'Please enter a valid age'],
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, 'PAN number cannot exceed 10 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    maritalStatus: {
      type: String,
      trim: true,
      enum: MARITAL_STATUS,
    },
    religion: {
      type: String,
      trim: true,
    },
    availability: {
      type: String,
      trim: true,
      maxlength: [200, 'Availability cannot exceed 200 characters'],
    },
    preferredJob: {
      type: String,
      trim: true,
    },
    duration: {
      type: String,
      trim: true,
    },
    languages: [
      {
        type: String,
        trim: true,
      },
    ],
    education: {
      type: String,
      trim: true,
      maxlength: [200, 'Education cannot exceed 200 characters'],
    },
    certificate: {
      type: String,
      trim: true,
      maxlength: [500, 'Certificate cannot exceed 500 characters'],
    },
    lastWorkingExperience: {
      jobTitle: { type: String, trim: true },
      duration: { type: String, trim: true },
      workingCity: { type: String, trim: true },
      reasonForLeaving: { type: String, trim: true },
      familySize: { type: String, trim: true },
      salary: { type: Number, min: [0, 'Salary cannot be negative'] },
      employerNationality: { type: String, trim: true },
    },
    jobDescription: {
      type: String,
      maxlength: [2000, 'Job description cannot exceed 2000 characters'],
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
    // A provider can submit more than one ID proof (e.g. Aadhaar + PAN +
    // passport), so this is a list instead of a single object.
    kycDocuments: [
      {
        idType: { type: String, trim: true },
        idNumber: { type: String, trim: true },
        idDocumentUrl: { type: String, trim: true },
      },
    ],
    // Optional "introduce yourself" video from the Review & submit step.
    introVideoUrl: {
      type: String,
      trim: true,
    },
    // Still frame of the intro video (the original is often 4K HEVC that browsers can't decode).
    introVideoThumbnailUrl: {
      type: String,
      trim: true,
    },
    // The upload as the provider sent it, kept when introVideoUrl is swapped for the web-friendly copy.
    introVideoOriginalUrl: {
      type: String,
      trim: true,
    },
    agreedToTerms: {
      type: Boolean,
      default: false,
    },
    agreedToTermsAt: {
      type: Date,
    },
    applicationStatus: {
      type: String,
      enum: APPLICATION_STATUS,
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

providerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

providerSchema.pre('save', function (next) {
  if (this.isModified('mobileNumber')) {
    this.mobileNumberDigits = this.mobileNumber ? this.mobileNumber.replace(/\D/g, '') : undefined;
  }
  next();
});

providerSchema.pre('save', function (next) {
  if (this.isModified('dateOfBirth') && this.dateOfBirth) {
    const today = new Date();
    const dob = new Date(this.dateOfBirth);
    let computedAge = today.getFullYear() - dob.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
    if (!hasHadBirthdayThisYear) computedAge -= 1;
    this.age = computedAge;
  }
  next();
});

providerSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

providerSchema.index({ emirate: 1 });
providerSchema.index({ skills: 1 });
providerSchema.index({ monthlySalary: 1 });
providerSchema.index({ categoryIds: 1 });
providerSchema.index({ area: 1 });
providerSchema.index({ applicationStatus: 1 });

// Collection name is pinned to the existing 'maids' collection so renaming
// the model doesn't orphan any provider already registered through the
// live API. Rename this (and migrate the collection) only in a deliberate,
// separate step.
module.exports = mongoose.model('Provider', providerSchema, 'maids');
