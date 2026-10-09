const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please login.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
      if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated.' });
      req.user = user;
    } else {
      const provider = await Provider.findById(decoded.id).select('-password');
      if (!provider) return res.status(401).json({ success: false, message: 'Provider not found.' });
      if (!provider.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated.' });
      req.provider = provider;
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const protectProvider = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please login.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'customer') {
      return res.status(403).json({ success: false, message: 'Provider login required.' });
    }
    const provider = await Provider.findById(decoded.id).select('-password');
    if (!provider) return res.status(401).json({ success: false, message: 'Provider not found.' });
    if (!provider.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    req.provider = provider;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const protectCustomer = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please login.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer') {
      return res.status(403).json({ success: false, message: 'Customer login required.' });
    }
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

module.exports = { protect, protectProvider, protectCustomer };
