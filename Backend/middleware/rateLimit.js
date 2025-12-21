const rateLimit = require("express-rate-limit")
const logger = require("../loaders/logger")

// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.originalUrl,
    })

    res.status(429).json({
      success: false,
      error: "Too many requests from this IP, please try again later.",
    })
  },
})

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, 
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.originalUrl,
    })

    res.status(429).json({
      success: false,
      error: "Too many authentication attempts, please try again later.",
    })
  },
})

// Rate limiting for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: "Too many password reset attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Password reset rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      email: req.body.email,
    })

    res.status(429).json({
      success: false,
      error: "Too many password reset attempts, please try again later.",
    })
  },
})

// Rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 upload requests per windowMs
  message: {
    success: false,
    error: "Too many upload attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.originalUrl,
    })

    res.status(429).json({
      success: false,
      error: "Too many upload attempts, please try again later.",
    })
  },
})

const attendanceLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 attendance requests per 5 minutes
  message: {
    success: false,
    error: "Too many attendance requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Attendance rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.originalUrl,
      memberId: req.body.memberId,
    })

    res.status(429).json({
      success: false,
      error: "Too many attendance requests, please try again later.",
    })
  },
})

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  uploadLimiter,
  attendanceLimit,
}
