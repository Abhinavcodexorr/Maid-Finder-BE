const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const User = require('../models/User');
const MESSAGES = require('../config/errorMessages.json');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.notAuthorized });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(401).json({ success: false, message: MESSAGES.auth.userNotFound });
      if (!user.isActive) return res.status(401).json({ success: false, message: MESSAGES.auth.accountDeactivated });
      req.user = user;
    } else {
      const provider = await Provider.findById(decoded.id).select('-password');
      if (!provider) return res.status(401).json({ success: false, message: MESSAGES.auth.providerNotFound });
      if (!provider.isActive) return res.status(401).json({ success: false, message: MESSAGES.auth.accountDeactivated });
      req.provider = provider;
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.invalidOrExpiredToken });
  }
};

const protectProvider = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.notAuthorized });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') {
      return res.status(403).json({ success: false, message: MESSAGES.auth.providerLoginRequired });
    }
    const provider = await Provider.findById(decoded.id).select('-password');
    if (!provider) return res.status(401).json({ success: false, message: MESSAGES.auth.providerNotFound });
    if (!provider.isActive) return res.status(401).json({ success: false, message: MESSAGES.auth.accountDeactivated });
    req.provider = provider;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.invalidOrExpiredToken });
  }
};

const protectCustomer = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.notAuthorized });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer') {
      return res.status(403).json({ success: false, message: MESSAGES.auth.customerLoginRequired });
    }
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: MESSAGES.auth.userNotFound });
    if (!user.isActive) return res.status(401).json({ success: false, message: MESSAGES.auth.accountDeactivated });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.invalidOrExpiredToken });
  }
};

module.exports = { protect, protectProvider, protectCustomer };
