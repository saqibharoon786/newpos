const jwt = require("jsonwebtoken")
const User = require("../models/user.model")
const { asyncHandler } = require("../utils/asyncHandler")
const { createResponse } = require("../utils/response")

// Protect routes - require authentication
const protect = asyncHandler(async (req, res, next) => {
  let token

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token) {
    return res.status(401).json(createResponse(false, "Access denied. No token provided."))
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from token
    const user = await User.findById(decoded.id).select("-password -refreshToken")

    if (!user) {
      return res.status(401).json(createResponse(false, "Token is not valid. User not found."))
    }

    if (!user.isActive) {
      return res.status(401).json(createResponse(false, "Account is deactivated."))
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json(createResponse(false, "Token is not valid."))
  }
})

// Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createResponse(false, "Access denied. Please login."))
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json(createResponse(false, "Access denied. Insufficient permissions."))
    }

    next()
  }
}

// Optional authentication - doesn't fail if no token
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.id).select("-password -refreshToken")

      if (user && user.isActive) {
        req.user = user
      }
    } catch (error) {
      // Token invalid, but continue without user
    }
  }

  next()
})

module.exports = {
  protect,
  authorize,
  optionalAuth,
}
