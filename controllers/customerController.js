const User = require('../models/User');
const generateToken = require('../utils/jwt');
const MESSAGES = require('../config/errorMessages.json');
const { releaseExpiredBlock } = require('../utils/customerBlock');
const normalizeCategoryIds = require('../utils/normalizeCategoryIds');

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone, emirate, address } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: MESSAGES.customer.emailAlreadyRegistered });
    }

    const user = await User.create({
      email,
      password,
      name,
      phone,
      emirate,
      address,
    });

    const token = generateToken(user._id, 'customer');
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emirate: user.emirate,
        address: user.address,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await releaseExpiredBlock(await User.findOne({ email }).select('+password'));
    if (!user) {
      return res.status(401).json({ success: false, message: MESSAGES.customer.invalidCredentials });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: MESSAGES.customer.invalidCredentials });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: MESSAGES.auth.accountDeactivated });
    }
    const token = generateToken(user._id, 'customer');
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emirate: user.emirate,
        address: user.address,
      },
    });
  } catch (error) {
    next(error);
  }
};

const PROFILE_TEXT_FIELDS = [['name', 100], ['phone', 30], ['emirate', 60], ['address', 300], ['city', 80], ['state', 80], ['requirementType', 40]];

// A customer fills in or fixes their own profile (the sign-up location/interests step).
exports.updateMe = async (req, res, next) => {
  try {
    const user = req.user;
    PROFILE_TEXT_FIELDS.forEach(([field, max]) => {
      if (typeof req.body[field] === 'string') user[field] = req.body[field].trim().slice(0, max);
    });
    if (req.body.lookingFor !== undefined) user.lookingFor = normalizeCategoryIds(req.body.lookingFor) ?? [];
    await user.save();
    const { password, __v, ...safe } = user.toObject();
    res.json({ success: true, user: { id: user._id, ...safe } });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
};
