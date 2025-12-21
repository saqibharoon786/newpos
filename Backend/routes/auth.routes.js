const express = require("express")
const router = express.Router()
const authController = require("../controllers/auth.controller")
const { protect } = require("../middleware/auth")
const { userValidation } = require("../middleware/validation")
const rateLimit = require("express-rate-limit")

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
})

// @route   POST /api/v1/auth/register
// @desc    Register new user
// @access  Private (Admin only)
router.post("/register", userValidation.register, authController.register)

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post("/login", authLimiter, userValidation.login, authController.login)

// @route   POST /api/v1/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post("/refresh-token", authController.refreshToken)

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", protect, authController.logout)

// @route   PUT /api/v1/auth/change-password
// @desc    Change password
// @access  Private
// router.put("/change-password", protect, authController.changePassword)

// @route   GET /api/v1/auth/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", protect, authController.getProfile)

module.exports = router
