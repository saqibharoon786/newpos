const User = require("../models/user.model")
const { asyncHandler } = require("../utils/asyncHandler")
const { createResponse, generatePaginationMeta } = require("../utils/response")
const { HTTP_STATUS, PAGINATION } = require("../middleware/constants")
const logger = require("../loaders/logger")

/**
 * @desc    Get all users
 * @route   GET /api/v1/users
 * @access  Private (Admin only)
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE
  const limit = Math.min(Number.parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT)
  const skip = (page - 1) * limit

  // Build query
  const query = {}
  if (req.query.role) {
    query.role = req.query.role
  }
  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === "true"
  }
  if (req.query.search) {
    query.$or = [
      { firstName: { $regex: req.query.search, $options: "i" } },
      { lastName: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
      { username: { $regex: req.query.search, $options: "i" } },
    ]
  }

  const [users, total] = await Promise.all([
    User.find(query).select("-password -refreshToken").sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ])

  const paginationMeta = generatePaginationMeta(page, total, limit)

  res.status(HTTP_STATUS.OK).json(createResponse(true, "Users retrieved successfully", { users }, paginationMeta))
})

/**
 * @desc    Get user by ID
 * @route   GET /api/v1/users/:id
 * @access  Private (Admin only)
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password -refreshToken")

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, "User not found"))
  }

  res.status(HTTP_STATUS.OK).json(createResponse(true, "User retrieved successfully", { user }))
})

/**
 * @desc    Update user
 * @route   PUT /api/v1/users/:id
 * @access  Private (Admin only)
 */
const updateUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, username, role } = req.body
  const userId = req.params.id

  // Check if username is already taken by another user
  if (username) {
    const existingUser = await User.findOne({
      username,
      _id: { $ne: userId },
    })

    if (existingUser) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(createResponse(false, "Username is already taken"))
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { firstName, lastName, phone, username, role },
    { new: true, runValidators: true },
  ).select("-password -refreshToken")

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, "User not found"))
  }

  logger.info(`User updated: ${user.email}`, {
    userId: user._id,
    updatedBy: req.user.id,
  })

  res.status(HTTP_STATUS.OK).json(createResponse(true, "User updated successfully", { user }))
})

/**
 * @desc    Update user status
 * @route   PUT /api/v1/users/:id/status
 * @access  Private (Admin only)
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body
  const userId = req.params.id

  const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true }).select("-password -refreshToken")

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, "User not found"))
  }

  logger.info(`User status updated: ${user.email}`, {
    userId: user._id,
    newStatus: isActive,
    updatedBy: req.user.id,
  })

  res
    .status(HTTP_STATUS.OK)
    .json(createResponse(true, `User ${isActive ? "activated" : "deactivated"} successfully`, { user }))
})

/**
 * @desc    Delete user (soft delete)
 * @route   DELETE /api/v1/users/:id
 * @access  Private (Admin only)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id

  // Prevent self-deletion
  if (userId === req.user.id) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(createResponse(false, "Cannot delete your own account"))
  }

  const user = await User.findByIdAndUpdate(userId, { isActive: false }, { new: true }).select(
    "-password -refreshToken",
  )

  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, "User not found"))
  }

  logger.info(`User deleted: ${user.email}`, {
    userId: user._id,
    deletedBy: req.user.id,
  })

  res.status(HTTP_STATUS.OK).json(createResponse(true, "User deleted successfully", { user }))
})

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
}
