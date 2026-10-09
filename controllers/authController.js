const MESSAGES = require('../config/errorMessages.json');

exports.logout = async (req, res, next) => {
  try {
    res.json({ success: true, message: MESSAGES.generic.loggedOut });
  } catch (error) {
    next(error);
  }
};
