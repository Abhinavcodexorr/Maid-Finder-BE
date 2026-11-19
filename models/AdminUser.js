const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// People who can sign in to the admin panel. A superadmin can work in every country and manage other
// admins; a subadmin only works in the countries listed in `countries`.
// (The original owner account still signs in from the panel's environment settings and acts as a superadmin.)
const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['superadmin', 'subadmin'], default: 'subadmin' },
    // Country codes this admin may use. Ignored for a superadmin (all countries).
    countries: { type: [String], default: [] },
    // What a subadmin may do (see config/permissions.js). Left unset for admins created before
    // permissions existed, who keep the "manager" set. Ignored for a superadmin.
    permissions: { type: [String], default: undefined },
    // Which ready-made role the permissions came from: manager | verifier | support | viewer | custom.
    roleTemplate: { type: String, trim: true },
    createdBy: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

adminUserSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password && !/^\$2[aby]\$/.test(this.password)) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

adminUserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('AdminUser', adminUserSchema, 'admin_users');
