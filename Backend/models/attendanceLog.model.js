const mongoose = require("mongoose")

const attendanceLogSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendanceDevice",
      required: true,
    },
    type: {
      type: String,
      enum: ["check-in", "check-out"],
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    method: {
      type: String,
      enum: ["card", "biometric", "mobile", "manual"],
      required: true,
      default: "card",
    },
    status: {
      type: String,
      enum: ["success", "denied", "error"],
      required: true,
      default: "success",
    },
    reason: {
      type: String,
      default: null, // Reason for denial or error
    },
    duration: {
      type: Number, // Duration in minutes (for check-out records)
      default: null,
    },
    location: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    metadata: {
      cardId: String,
      biometricId: String,
      mobileDeviceId: String,
      temperature: Number, // Body temperature if available
      additionalData: mongoose.Schema.Types.Mixed,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for automatic records
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Index for efficient queries
attendanceLogSchema.index({ member: 1, timestamp: -1 })
attendanceLogSchema.index({ device: 1, timestamp: -1 })
attendanceLogSchema.index({ timestamp: -1 })

// Virtual for formatted duration
attendanceLogSchema.virtual("formattedDuration").get(function () {
  if (!this.duration) return null

  const hours = Math.floor(this.duration / 60)
  const minutes = this.duration % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
})

// Static method to get member's current status
attendanceLogSchema.statics.getMemberCurrentStatus = async function (memberId) {
  const lastRecord = await this.findOne({ member: memberId }).sort({ timestamp: -1 }).populate("device")

  if (!lastRecord) return "out"

  return lastRecord.type === "check-in" ? "in" : "out"
}

// Static method to calculate session duration
attendanceLogSchema.statics.calculateSessionDuration = async function (memberId, checkInTime) {
  const checkOutRecord = await this.findOne({
    member: memberId,
    type: "check-out",
    timestamp: { $gt: checkInTime },
  }).sort({ timestamp: 1 })

  if (!checkOutRecord) return null

  const duration = Math.floor((checkOutRecord.timestamp - checkInTime) / (1000 * 60))
  return duration
}

module.exports = mongoose.model("AttendanceLog", attendanceLogSchema)
