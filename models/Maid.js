const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { VISA_STATUS } = require('../config/constants');

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
      enum: VISA_STATUS,
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
