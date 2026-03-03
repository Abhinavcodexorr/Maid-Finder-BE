const jwt = require('jsonwebtoken');
const Maid = require('../models/Maid');
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
      const maid = await Maid.findById(decoded.id).select('-password');
      if (!maid) return res.status(401).json({ success: false, message: 'Maid not found.' });
      if (!maid.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated.' });
      req.maid = maid;
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const protectMaid = async (req, res, next) => {
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
      return res.status(403).json({ success: false, message: 'Maid login required.' });
    }
    const maid = await Maid.findById(decoded.id).select('-password');
    if (!maid) return res.status(401).json({ success: false, message: 'Maid not found.' });
    if (!maid.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    req.maid = maid;
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

module.exports = { protect, protectMaid, protectCustomer };
