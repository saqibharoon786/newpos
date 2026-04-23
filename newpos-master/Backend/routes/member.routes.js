const express = require("express")
const router = express.Router()
const memberController = require("../controllers/member.controller")
const { protect, authorize } = require("../middleware/auth")
const { memberValidation, commonValidations } = require("../middleware/validation")

// All routes are protected and require authentication
router.use(protect)

// // @route   GET /api/v1/members/overdue
// // @desc    Get overdue members
// // @access  Private
// router.get("/overdue", memberController.getOverdueMembers)

// // @route   GET /api/v1/members
// // @desc    Get all members
// // @access  Private
router.get("/get-all-members",  memberController.getAllMembers)

// @route   POST /api/v1/members
// @desc    Create new member
// @access  Private
router.post("/create-members",memberController.createMember)

// @route   GET /api/v1/members/:id
// @desc    Get member by ID
// @access  Private
router.get("/:id", memberController.getMemberById)

// @route   PUT /api/v1/members/:id
// @desc    Update member
// @access  Private
router.put("/update-member/:id", memberController.updateMember)

// @route   DELETE /api/v1/members/:id
// @desc    Delete member
// @access  Private
// router.delete("/:id", memberController.deleteMember)

// // @route   POST /api/v1/members/:id/notes
// // @desc    Add note to member
// // @access  Private
// router.post("/:id/notes", memberController.addMemberNote)

// @route   PUT /api/v1/members/:id/payment-status
// @desc    Update member payment status
// @access  Private
router.put("/:id/payment-status", memberController.updatePaymentStatus)

module.exports = router
