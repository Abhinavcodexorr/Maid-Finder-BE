const jwt = require('jsonwebtoken');
const { JWT_EXPIRES_IN } = require('../config/constants');

const generateToken = (id, type = 'maid') => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

module.exports = generateToken;
