
module.exports = (err, req, res, next) => {
  // Log the error for server-side tracking
  console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
  });

  // Specific error type handling
  if (err.name === 'ValidationError') {
      return res.status(400).json({
          message: 'Validation Error',
          errors: err.errors
      });
  }

  if (err.name === 'UnauthorizedError') {
      return res.status(401).json({
          message: 'Unauthorized: Invalid or expired token'
      });
  }

  if (err.code === '23505') {
      return res.status(409).json({
          message: 'Duplicate key error',
          detail: err.detail
      });
  }

  // Default error response
  res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};