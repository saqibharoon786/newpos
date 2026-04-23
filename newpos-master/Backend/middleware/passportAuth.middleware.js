const passport = require("passport")
const JwtStrategy = require("passport-jwt").Strategy
const ExtractJwt = require("passport-jwt").ExtractJwt
const LocalStrategy = require("passport-local").Strategy
const User = require("../models/user.model")
const logger = require("../loaders/logger")

// JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
}

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findById(payload.id).select("-password -refreshToken")

      if (user && user.isActive) {
        return done(null, user)
      } else {
        return done(null, false)
      }
    } catch (error) {
      logger.error("JWT Strategy error:", error)
      return done(error, false)
    }
  }),
)

// Local Strategy for login
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email }).select("+password")

        if (!user) {
          return done(null, false, { message: "Invalid email or password" })
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is deactivated" })
        }

        const isMatch = await user.comparePassword(password)

        if (!isMatch) {
          return done(null, false, { message: "Invalid email or password" })
        }

        // Update last login
        await user.updateLastLogin()

        return done(null, user)
      } catch (error) {
        logger.error("Local Strategy error:", error)
        return done(error)
      }
    },
  ),
)

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      logger.error("Authentication error:", err)
      return res.status(500).json({
        success: false,
        error: "Authentication error",
      })
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Access denied. Invalid or expired token.",
      })
    }

    req.user = user
    next()
  })(req, res, next)
}

// Middleware to check user roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Access denied. Please login first.",
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(" or ")}`,
      })
    }

    next()
  }
}

// Middleware to check if user is admin
const requireAdmin = authorizeRoles("admin")

// Middleware to check if user is admin or reception
const requireStaff = authorizeRoles("admin", "reception")

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireStaff,
  passport,
}
