const authService = require("../services/auth.service")
const { asyncHandler } = require("../utils/asyncHandler")
const { createResponse } = require("../utils/response")
const { HTTP_STATUS } = require("../middleware/constants")
const { generateAccessToken } = require("../utils/jwt")

/**
 * @desc    Register new user
 * @route   POST /api/v1/auth/register
 * @access  Private (Admin only)
 */
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body)
  console.log('the body is', req.body)

  res.status(HTTP_STATUS.CREATED).json(createResponse(true, "User registered successfully", result))
})

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const result = await authService.login(email, password)

  res.status(HTTP_STATUS.OK).json(createResponse(true, "Login successful", result))
})

/** Owner / super-admin CMS login — returns JWT (works on live server without custom headers) */
const ownerSession = asyncHandler(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase()
  const password = req.body.password || ""
  const ownerEmail = (process.env.CMS_OWNER_EMAIL || "superadmin@gmail.com").toLowerCase()
  const ownerPassword = process.env.CMS_OWNER_PASSWORD || "786786"

  if (email !== ownerEmail || password !== ownerPassword) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(createResponse(false, "Invalid credentials"))
  }

  const accessToken = generateAccessToken({
    id: "super-admin",
    role: "owner",
    email: ownerEmail,
  })

  res.status(HTTP_STATUS.OK).json(
    createResponse(true, "Login successful", {
      user: {
        _id: "super-admin",
        id: "super-admin",
        email: ownerEmail,
        role: "owner",
        username: "owner",
        firstName: "Owner",
        lastName: "",
        fullName: "Owner",
      },
      tokens: { accessToken, refreshToken: accessToken },
    })
  )
})

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createResponse(false, "Refresh token is required")
    );
  }

  const tokens = await authService.refreshToken(refreshToken);

  // Return consistent structure with other endpoints
  res.status(HTTP_STATUS.OK).json(createResponse(true, "Token refreshed successfully", tokens));
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id)

  res.status(HTTP_STATUS.OK).json(createResponse(true, "Logout successful"))
})

/**
 * @desc    Change password
 * @route   PUT /api/v1/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  await authService.changePassword(req.user.id, currentPassword, newPassword)

  res.status(HTTP_STATUS.OK).json(createResponse(true, "Password changed successfully"))
})

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/profile
 * @access  Private
 */
const getProfile = asyncHandler(async (req, res) => {
  res.status(HTTP_STATUS.OK).json(createResponse(true, "Profile retrieved successfully", { user: req.user }))
})

module.exports = {
  register,
  login,
  ownerSession,
  refreshToken,
  logout,
  changePassword,
  getProfile,
}