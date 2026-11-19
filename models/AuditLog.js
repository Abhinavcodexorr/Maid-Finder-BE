const mongoose = require('mongoose');

// Append-only record of what admins did (and tried to do) in the panel. Nothing in the API edits or
// deletes these rows.
const auditLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    actor: {
      adminId: String,
      email: { type: String, lowercase: true, trim: true },
      name: String,
      // superadmin | subadmin | system (a call made with the API key alone)
      role: String,
      // env (owner account) | db (created in the Admins page) | api-key
      source: String,
    },
    // e.g. provider.approve, plan.delete, auth.login, access.denied
    action: { type: String, index: true },
    resource: String, // provider, customer, service, plan, admin, subscription, auth
    resourceId: String,
    resourceLabel: String, // a readable name captured at the time (the record may be deleted later)
    country: String,
    method: String,
    path: String,
    status: Number,
    success: { type: Boolean, default: true },
    message: String,
    // For edits: { field: { from, to } }. For other writes: what was submitted (secrets removed).
    changes: mongoose.Schema.Types.Mixed,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { versionKey: false }
);

auditLogSchema.index({ 'actor.email': 1, at: -1 });
auditLogSchema.index({ country: 1, at: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
