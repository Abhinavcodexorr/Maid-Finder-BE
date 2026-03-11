const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (err.name === 'CastError') {
    error.message = 'Resource not found';
    error.statusCode = 404;
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    error.message = `${field} already exists`;
    error.statusCode = 400;
  }

  if (err.name === 'ValidationError') {
    error.message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    error.statusCode = 400;
  }

  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    error.message = 'Image size must be less than 5MB';
    error.statusCode = 400;
  }

  const statusCode = error.statusCode || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
