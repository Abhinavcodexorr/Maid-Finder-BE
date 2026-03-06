const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MARITAL_STATUS } = require('../config/constants');

const maidSchema = new mongoose.Schema(
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
    nationality: {
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

maidSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

maidSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

maidSchema.index({ emirate: 1 });
maidSchema.index({ skills: 1 });
maidSchema.index({ monthlySalaryAed: 1 });

module.exports = mongoose.model('Maid', maidSchema);
