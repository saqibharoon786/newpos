const express = require("express")
const router = express.Router()
const attendanceController = require("../controllers/attendance.controller")
const { protect, optionalAuth } = require("../middleware/auth")
const { attendanceValidation, commonValidations } = require("../middleware/validation")

// @route   POST /api/v1/attendance/access
// @desc    Process door access (check-in/check-out)
// @access  Public (for door devices)
router.post("/access", attendanceController.processDoorAccess)

// @route   POST /api/v1/attendance/verify
// @desc    Verify member access
// @access  Public (for door devices)
router.post("/verify", attendanceController.verifyMemberAccess)

// Protected routes
router.use(protect)

// @route   GET /api/v1/attendance/status/:memberId
// @desc    Get member current status
// @access  Private
router.get("/status/:memberId", attendanceController.getMemberStatus)

// @route   GET /api/v1/attendance/logs
// @desc    Get attendance logs
// @access  Private
router.get("/logs", commonValidations.pagination, attendanceController.getAttendanceLogs)

// @route   POST /api/v1/attendance/manual
// @desc    Manual check-in/check-out
// @access  Private
router.post("/manual", attendanceValidation.checkIn, attendanceController.manualAttendance)

module.exports = router
