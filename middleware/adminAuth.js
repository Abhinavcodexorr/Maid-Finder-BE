const adminAuth = (req, res, next) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    return res.status(500).json({ success: false, message: 'Admin API is not configured' });
  }
  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }
  next();
};

module.exports = adminAuth;
