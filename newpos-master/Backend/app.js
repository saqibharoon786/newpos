const express = require("express")
const helmet = require("helmet")
const morgan = require("morgan")
const rateLimit = require("express-rate-limit")
const mongoSanitize = require("express-mongo-sanitize")
const xss = require("xss-clean")
const hpp = require("hpp")
const compression = require("compression")

const { corsMiddleware } = require("./middleware/cors")
const errorHandler = require("./middleware/errorHandler")
const logger = require("./config/logger")
const { RATE_LIMITS } = require("./middleware/constants")

// Import routes
const apiRoutes = require("./routes")

const app = express()

// Trust proxy
app.set("trust proxy", 1)

// Security middleware
app.use(helmet())
app.use(corsMiddleware)

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.windowMs,
  max: RATE_LIMITS.GENERAL.max,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
})
app.use("/api/", limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Data sanitization against NoSQL query injection
app.use(mongoSanitize())

// Data sanitization against XSS
app.use(xss())

// Prevent parameter pollution
app.use(hpp())

// Compression middleware
app.use(compression())

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }))
} else {
  app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }))
}

// API routes
app.use("/api/v1", apiRoutes)

// 404 handler
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  })
})

// Global error handler
app.use(errorHandler)

module.exports = app
