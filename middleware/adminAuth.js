const MESSAGES = require('../config/errorMessages.json');

const adminAuth = (req, res, next) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    return res.status(500).json({ success: false, message: MESSAGES.admin.notConfigured });
  }
  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({ success: false, message: MESSAGES.admin.invalidCredentials });
  }
  next();
};

module.exports = adminAuth;
