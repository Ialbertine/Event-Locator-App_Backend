// Not Found (404) handler
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  
  res.json({
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
      errors: err.errors || undefined
  });
};

// Handle unhandled promise rejections (for use in server.js)
const unhandledRejectionHandler = (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optional: Graceful shutdown
  process.exit(1);
};

// Handle uncaught exceptions (for use in server.js)
const uncaughtExceptionHandler = (error) => {
  console.error('Uncaught Exception:', error);
  // Optional: Graceful shutdown
  process.exit(1);
};

module.exports = {
  notFoundHandler,
  errorHandler,
  unhandledRejectionHandler,
  uncaughtExceptionHandler
};