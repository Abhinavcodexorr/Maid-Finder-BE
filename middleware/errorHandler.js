const MESSAGES = require('../config/errorMessages.json');
const formatMessage = require('../utils/formatMessage');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (err.name === 'CastError') {
    error.message = MESSAGES.server.resourceNotFound;
    error.statusCode = 404;
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    error.message = formatMessage(MESSAGES.server.fieldAlreadyExists, { field });
    error.statusCode = 400;
  }

  if (err.name === 'ValidationError') {
    error.message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    error.statusCode = 400;
  }

  if (err.name === 'JsonWebTokenError') {
    error.message = MESSAGES.server.invalidToken;
    error.statusCode = 401;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    error.message = MESSAGES.upload.fileTooLarge;
    error.statusCode = 400;
  }

  const statusCode = error.statusCode || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || MESSAGES.server.serverError,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
