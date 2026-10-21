const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
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
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
    },
    emirate: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    // false = blocked/deactivated: the account can no longer sign in or use the app.
    isActive: {
      type: Boolean,
      default: true,
    },
    // Set when an admin blocks the account; cleared when it is unblocked.
    blockedAt: {
      type: Date,
    },
    blockReason: {
      type: String,
      trim: true,
      maxlength: [300, 'Reason cannot exceed 300 characters'],
    },
    // Timed block: the account is released automatically after this moment. Empty = until an admin unblocks.
    blockedUntil: {
      type: Date,
    },
    // Watch list: an admin marked the account for attention without blocking it.
    flagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
      trim: true,
      maxlength: [300, 'Reason cannot exceed 300 characters'],
    },
    // Internal notes only admins see.
    adminNotes: {
      type: [
        new mongoose.Schema(
          {
            text: { type: String, required: true, trim: true, maxlength: 1000 },
            at: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    // Everything an admin (or a timer) did to the account's standing.
    moderationLog: {
      type: [
        new mongoose.Schema(
          {
            action: {
              type: String,
              enum: ['blocked', 'unblocked', 'auto_unblocked', 'flagged', 'unflagged', 'edited'],
              required: true,
            },
            reason: { type: String, trim: true },
            until: { type: Date },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
