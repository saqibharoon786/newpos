const Member = require("../models/member.model")
const AttendanceDevice = require("../models/attendance.device.model")
const AttendanceLog = require("../models/attendance.log.model")
const logger = require("../config/logger")

class DoorService {
  // Verify member access
  async verifyMemberAccess(memberId, deviceId) {
    try {
      // Find member
      const member = await Member.findOne({ memberId: memberId.toUpperCase() })

      if (!member) {
        return {
          access: false,
          reason: "Member not found",
        }
      }

      // Check if member is active
      if (!member.isActive) {
        return {
          access: false,
          reason: "Member account is inactive",
        }
      }

      // Check door access permission
      if (!member.doorAccessEnabled) {
        return {
          access: false,
          reason: "Door access is disabled",
        }
      }

      // Check membership status
      const membershipStatus = member.membershipStatus
      if (membershipStatus === "expired") {
        return {
          access: false,
          reason: "Membership has expired",
        }
      }

      // Check payment status (allow 30-day grace period)
      if (member.isPaymentOverdue()) {
        // Disable door access for overdue payments
        await member.disableDoorAccess()
        return {
          access: false,
          reason: "Payment overdue - access suspended",
        }
      }

      // Find device
      const device = await AttendanceDevice.findOne({ deviceId: deviceId.toUpperCase() })

      if (!device) {
        return {
          access: false,
          reason: "Device not found",
        }
      }

      if (!device.isActive) {
        return {
          access: false,
          reason: "Device is inactive",
        }
      }

      // All checks passed
      return {
        access: true,
        member: {
          id: member._id,
          memberId: member.memberId,
          name: member.fullName,
          membershipType: member.membershipType,
        },
        device: {
          id: device._id,
          name: device.name,
          location: device.location,
        },
      }
    } catch (error) {
      logger.error("Verify member access error:", error)
      return {
        access: false,
        reason: "System error",
      }
    }
  }

  // Process door access (check-in/check-out)
  async processDoorAccess(memberId, deviceId, accessType = "auto") {
    try {
      // Verify access
      const accessResult = await this.verifyMemberAccess(memberId, deviceId)

      if (!accessResult.access) {
        // Log denied access
        await this.logAccess({
          member: null,
          device: null,
          type: "check-in",
          status: "denied",
          reason: accessResult.reason,
          location: "Unknown",
          ipAddress: "0.0.0.0",
          method: "card",
        })

        return accessResult
      }

      // Determine if this is check-in or check-out
      const lastRecord = await AttendanceLog.findOne({
        member: accessResult.member.id,
      }).sort({ timestamp: -1 })

      let accessTypeToLog = "check-in"
      let duration = null

      if (lastRecord && lastRecord.type === "check-in") {
        // This is a check-out
        accessTypeToLog = "check-out"
        duration = Math.floor((new Date() - lastRecord.timestamp) / (1000 * 60)) // minutes
      }

      // Log successful access
      const logEntry = await this.logAccess({
        member: accessResult.member.id,
        device: accessResult.device.id,
        type: accessTypeToLog,
        status: "success",
        reason: null,
        duration: duration,
        location: accessResult.device.location,
        ipAddress: "192.168.1.100", // This would come from the actual device
        method: "card",
      })

      // Update device heartbeat
      await AttendanceDevice.findByIdAndUpdate(accessResult.device.id, { lastHeartbeat: new Date() })

      logger.info(
        `Door access granted: ${accessResult.member.memberId} - ${accessTypeToLog} at ${accessResult.device.location}`,
      )

      return {
        access: true,
        type: accessTypeToLog,
        member: accessResult.member,
        device: accessResult.device,
        duration: duration,
        logId: logEntry._id,
      }
    } catch (error) {
      logger.error("Process door access error:", error)
      throw error
    }
  }

  // Log access attempt
  async logAccess(logData) {
    try {
      const log = new AttendanceLog(logData)
      await log.save()
      return log
    } catch (error) {
      logger.error("Log access error:", error)
      throw error
    }
  }

  // Get member current status
  async getMemberCurrentStatus(memberId) {
    try {
      const member = await Member.findOne({ memberId: memberId.toUpperCase() })

      if (!member) {
        throw new Error("Member not found")
      }

      const status = await AttendanceLog.getMemberCurrentStatus(member._id)

      return {
        memberId: member.memberId,
        name: member.fullName,
        status: status,
        lastActivity: await AttendanceLog.findOne({ member: member._id })
          .sort({ timestamp: -1 })
          .populate("device", "name location"),
      }
    } catch (error) {
      logger.error("Get member current status error:", error)
      throw error
    }
  }

  // Get attendance logs
  async getAttendanceLogs(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination
      const skip = (page - 1) * limit

      // Build query
      const query = {}

      if (filters.memberId) {
        const member = await Member.findOne({ memberId: filters.memberId.toUpperCase() })
        if (member) {
          query.member = member._id
        }
      }

      if (filters.deviceId) {
        const device = await AttendanceDevice.findOne({ deviceId: filters.deviceId.toUpperCase() })
        if (device) {
          query.device = device._id
        }
      }

      if (filters.type) {
        query.type = filters.type
      }

      if (filters.status) {
        query.status = filters.status
      }

      if (filters.dateFrom || filters.dateTo) {
        query.timestamp = {}
        if (filters.dateFrom) {
          query.timestamp.$gte = new Date(filters.dateFrom)
        }
        if (filters.dateTo) {
          query.timestamp.$lte = new Date(filters.dateTo)
        }
      }

      // Execute query
      const [logs, total] = await Promise.all([
        AttendanceLog.find(query)
          .populate("member", "memberId firstName lastName")
          .populate("device", "deviceId name location")
          .populate("recordedBy", "firstName lastName")
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        AttendanceLog.countDocuments(query),
      ])

      return {
        logs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      }
    } catch (error) {
      logger.error("Get attendance logs error:", error)
      throw error
    }
  }
}

module.exports = new DoorService()
