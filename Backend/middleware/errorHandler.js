const httpStatus = require("http-status");
const logger = require("../loaders/logger");
const { createResponse } = require("../utils/response");

// Define fallback status codes in case http-status returns undefined
const STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
};

// Helper function to get status code with fallback
const getStatusCode = (statusKey) => {
  return httpStatus[statusKey] || STATUS_CODES[statusKey] || 500;
};

const notFound = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = getStatusCode('NOT_FOUND');
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || err.status || 500;
  let message = err.message || "Something went wrong";
  let details = null;
  
  // Handle various error types
  switch (true) {
    // Mongoose validation error
    case err.name === 'ValidationError':
      status = getStatusCode('BAD_REQUEST');
      message = "Validation failed";
      details = Object.values(err.errors).map(val => ({
        field: val.path,
        message: val.message
      }));
      break;
    
    // Mongoose duplicate key error
    case err.code === 11000:
      status = getStatusCode('CONFLICT');
      const field = Object.keys(err.keyValue)[0];
      message = `${field} already exists`;
      break;
    
    // Mongoose CastError (invalid ObjectId)
    case err.name === 'CastError':
      status = getStatusCode('BAD_REQUEST');
      message = `Invalid ${err.path}: ${err.value}`;
      break;
    
    // JWT errors
    case err.name === 'JsonWebTokenError':
      status = getStatusCode('UNAUTHORIZED');
      message = 'Invalid token';
      break;
    
    case err.name === 'TokenExpiredError':
      status = getStatusCode('UNAUTHORIZED');
      message = 'Token expired';
      break;
    
    // Multer file upload errors
    case err.code === 'LIMIT_FILE_SIZE':
      status = getStatusCode('BAD_REQUEST');
      message = 'File too large';
      break;
    
    case err.code === 'LIMIT_UNEXPECTED_FILE':
      status = getStatusCode('BAD_REQUEST');
      message = 'Unexpected file field';
      break;
    
    // Rate limiting errors
    case err.statusCode === 429:
      status = getStatusCode('TOO_MANY_REQUESTS');
      message = 'Too many requests, please try again later';
      break;
    
    // Syntax errors (malformed JSON)
    case err.type === 'entity.parse.failed':
      status = getStatusCode('BAD_REQUEST');
      message = 'Malformed JSON';
      break;
  }
  
  // Final status determination with fallback - ensure it's a number
  status = parseInt(status) || getStatusCode('INTERNAL_SERVER_ERROR');
  
  // Ensure status is within valid HTTP range (100-599)
  if (status < 100 || status > 599) {
    status = getStatusCode('INTERNAL_SERVER_ERROR');
  }
  
  // Log server errors only (500 and above)
  if (status >= 500) {
    logger.error({
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      user: req.user ? (req.user._id || req.user.id) : 'Unauthenticated'
    }, 'Server Error');
  } else {
    // Log client errors at warning level
    logger.warn({
      message: err.message,
      url: req.originalUrl,
      method: req.method,
      status: status,
      user: req.user ? (req.user._id || req.user.id) : 'Unauthenticated'
    }, 'Client Error');
  }

  // Use createResponse for consistent response structure
  res.status(status).json(createResponse(
    false, 
    message, 
    process.env.NODE_ENV === 'development' ? { stack: err.stack, error: err } : null,
    details || err.errors
  ));
};

module.exports = { notFound, errorHandler };