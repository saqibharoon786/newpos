const express = require("express")
const router = express.Router()
const userController = require("../controllers/user.controller")
const { protect, authorize } = require("../middleware/auth")
const { userValidation, commonValidations } = require("../middleware/validation")

// All routes are protected and require authentication
router.use(protect)

// @route   GET /api/v1/users
// @desc    Get all users
// @access  Private (Admin only)
router.get("/get-all-users", authorize("admin"), commonValidations.pagination, userController.getAllUsers)

// @route   GET /api/v1/users/:id
// @desc    Get user by ID
// @access  Private (Admin only)
router.get("/get-user/:id", authorize("admin"), userValidation.getById, userController.getUserById)

// @route   PUT /api/v1/users/:id
// @desc    Update user
// @access  Private (Admin only)
router.put("/:id", authorize("admin"), userValidation.update, userController.updateUser)

// // @route   PUT /api/v1/users/:id/status
// // @desc    Update user status
// // @access  Private (Admin only)
// router.put("/:id/status", authorize("admin"), userController.updateUserStatus)

// // @route   DELETE /api/v1/users/:id
// // @desc    Delete user (soft delete)
// // @access  Private (Admin only)
// router.delete("/:id", authorize("admin"), userController.deleteUser)

module.exports = router
