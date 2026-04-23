const doorService = require("../services/door.service")
const { asyncHandler } = require("../utils/asyncHandler")
const { createResponse } = require("../utils/response")
const { HTTP_STATUS } = require("../middleware/constants")

/**
 * @desc    Process door access (check-in/check-out)
 * @route   POST /api/v1/attendance/access
 * @access  Public (for door devices)
 */
const processDoorAccess = asyncHandler(async (req, res) => {
  const { memberId, deviceId } = req.body
  const result = await doorService.processDoorAccess(memberId, deviceId)

  if (!result.access) {
    return res.status(HTTP_STATUS.FORBIDDEN).json(createResponse(false, result.reason || "Access denied"))
  }

  res.status(HTTP_STATUS.OK).json(createResponse(true, `${result.type} successful`, result))
})

/**
 * @desc    Verify member access
 * @route   POST /api/v1/attendance/verify
 * @access  Public (for door devices)
 */
const verifyMemberAccess = asyncHandler(async (req, res) => {
  const { memberId, deviceId } = req.body
  const result = await doorService.verifyMemberAccess(memberId, deviceId)

  res.status(HTTP_STATUS.OK).json(createResponse(true, "Access verification completed", result))
})

/**
 * @desc    Get member current status
 * @route   GET /api/v1/attendance/status/:memberId
 * @access  Private
 */
const getMemberStatus = asyncHandler(async (req, res) => {
  const status = await doorService.getMemberCurrentStatus(req.params.memberId)

  res.status(HTTP_STATUS.OK).json(createResponse(true, "Member status retrieved successfully", status))
})

/**
 * @desc    Get attendance logs
 * @route   GET /api/v1/attendance/logs
 * @access  Private
 */
const getAttendanceLogs = asyncHandler(async (req, res) => {
  const filters = {
    memberId: req.query.memberId,
    deviceId: req.query.deviceId,
    type: req.query.type,
    status: req.query.status,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
  }

  const pagination = {
    page: Number.parseInt(req.query.page) || 1,
    limit: Number.parseInt(req.query.limit) || 50,
  }

  const result = await doorService.getAttendanceLogs(filters, pagination)

  res
    .status(HTTP_STATUS.OK)
    .json(
      createResponse(true, "Attendance logs retrieved successfully", result.logs, { pagination: result.pagination }),
    )
})

/**
 * @desc    Manual check-in/check-out
 * @route   POST /api/v1/attendance/manual
 * @access  Private
 */
const manualAttendance = asyncHandler(async (req, res) => {
  const { memberId, type, deviceId, reason } = req.body

  // Log manual attendance
  const logData = {
    member: memberId,
    device: deviceId,
    type: type,
    status: "success",
    reason: reason || "Manual entry",
    location: "Manual Entry",
    ipAddress: req.ip,
    method: "manual",
    recordedBy: req.user.id,
  }

  const log = await doorService.logAccess(logData)

  res.status(HTTP_STATUS.CREATED).json(createResponse(true, "Manual attendance recorded successfully", { log }))
})

module.exports = {
  processDoorAccess,
  verifyMemberAccess,
  getMemberStatus,
  getAttendanceLogs,
  manualAttendance,
}
