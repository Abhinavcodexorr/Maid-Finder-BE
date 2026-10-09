const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MARITAL_STATUS } = require('../config/constants');

const providerSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
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
    categoryId: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    // Digits-only copy of mobileNumber, kept in sync in the pre-save hook
    // below, so phone login works regardless of spaces/dashes/country-code
    // formatting differences between registration and login.
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
    visaStatus: {
      type: String,
      trim: true,
    },
    experienceYears: {
      type: Number,
      min: [0, 'Experience cannot be negative'],
    },
    monthlySalaryAed: {
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
    hasPassport: {
      type: Boolean,
      default: false,
    },
    visaExpiryDate: {
      type: Date,
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
    hasReferenceLetter: {
      type: Boolean,
      default: false,
    },
    referenceLetterUrl: {
      type: String,
      trim: true,
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
    kyc: {
      idType: { type: String, trim: true },
      idNumber: { type: String, trim: true },
      idDocumentUrl: { type: String, trim: true },
    },
    applicationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
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

providerSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

providerSchema.index({ emirate: 1 });
providerSchema.index({ skills: 1 });
providerSchema.index({ monthlySalaryAed: 1 });
providerSchema.index({ categoryId: 1 });
providerSchema.index({ area: 1 });
providerSchema.index({ applicationStatus: 1 });

// Collection name is pinned to the existing 'maids' collection so renaming
// the model doesn't orphan any provider already registered through the
// live API. Rename this (and migrate the collection) only in a deliberate,
// separate step.
module.exports = mongoose.model('Provider', providerSchema, 'maids');
