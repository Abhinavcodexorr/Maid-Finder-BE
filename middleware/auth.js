const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const User = require('../models/User');
const MESSAGES = require('../config/errorMessages.json');
const { releaseExpiredBlock } = require('../utils/customerBlock');

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }
  return req.headers['x-access-token'] || req.body?.token || req.query?.token || null;
};

const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.notAuthorized });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') {
      const user = await releaseExpiredBlock(await User.findById(decoded.id).select('-password'));
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

const optionalProtect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') {
      const user = await releaseExpiredBlock(await User.findById(decoded.id).select('-password'));
      if (user && user.isActive) req.user = user;
    } else {
      const provider = await Provider.findById(decoded.id).select('-password');
      if (provider && provider.isActive) req.provider = provider;
    }
  } catch (_) {
    // Optional auth: ignore token errors and let request proceed unauthenticated
  }
  next();
};

const protectProvider = async (req, res, next) => {
  const token = extractToken(req);
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
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.notAuthorized });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer') {
      return res.status(403).json({ success: false, message: MESSAGES.auth.customerLoginRequired });
    }
    const user = await releaseExpiredBlock(await User.findById(decoded.id).select('-password'));
    if (!user) return res.status(401).json({ success: false, message: MESSAGES.auth.userNotFound });
    if (!user.isActive) return res.status(401).json({ success: false, message: MESSAGES.auth.accountDeactivated });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: MESSAGES.auth.invalidOrExpiredToken });
  }
};

module.exports = { protect, optionalProtect, protectProvider, protectCustomer };
