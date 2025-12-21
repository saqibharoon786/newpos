const helmet = require("helmet")
const logger = require("../loaders/logger")

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
})

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts from request body
  if (req.body) {
    req.body = sanitizeObject(req.body)
  }

  // Remove any potential XSS attempts from query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query)
  }

  next()
}

// Helper function to sanitize objects recursively
const sanitizeObject = (obj) => {
  if (typeof obj === "string") {
    // Remove script tags and other potentially dangerous content
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  } else if (obj && typeof obj === "object") {
    const sanitized = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key])
      }
    }
    return sanitized
  }
  return obj
}

// Request logging middleware for security monitoring
const securityLogger = (req, res, next) => {
  // Log suspicious patterns
  const suspiciousPatterns = [
    /(<script|javascript:|on\w+\s*=)/i,
    /(union\s+select|drop\s+table|insert\s+into)/i,
    /(\.\.\/|\.\.\\)/,
    /(<iframe|<object|<embed)/i,
  ]

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  })

  const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(requestData))

  if (isSuspicious) {
    logger.warn("Suspicious request detected", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
    })
  }

  next()
}

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    const allowedOrigins = ["http://localhost:3000", "http://localhost:3001", "https://your-gym-frontend.com"]

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`)
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
}

module.exports = {
  securityHeaders,
  sanitizeInput,
  securityLogger,
  corsOptions,
}
