const mongoose = require("mongoose")

const attendanceSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true,
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, 
      default: 0,
    },
    status: {
      type: String,
      enum: ["checked-in", "checked-out", "incomplete"],
      default: "checked-in",
    },
    doorAccessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DoorAccess",
      required: false,
    },
    location: {
      type: String,
      default: "Main Entrance",
    },
    deviceId: {
      type: String,
      required: false,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for formatted duration
attendanceSchema.virtual("formattedDuration").get(function () {
  if (this.duration === 0) return "0 minutes"
  const hours = Math.floor(this.duration / 60)
  const minutes = this.duration % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})

// Virtual for session status
attendanceSchema.virtual("isActive").get(function () {
  return this.status === "checked-in" && !this.checkOutTime
})

// Indexes for better query performance
attendanceSchema.index({ memberId: 1, checkInTime: -1 })
attendanceSchema.index({ status: 1, checkInTime: -1 })
attendanceSchema.index({ createdAt: -1 })

// Pre-save middleware to calculate duration
attendanceSchema.pre("save", function (next) {
  if (this.checkOutTime && this.checkInTime) {
    this.duration = Math.round((this.checkOutTime - this.checkInTime) / (1000 * 60))
    this.status = "checked-out"
  } else if (this.checkInTime && !this.checkOutTime) {
    this.status = "checked-in"
    this.duration = 0
  }
  next()
})

// Static methods
attendanceSchema.statics.getActiveSession = function (memberId) {
  return this.findOne({
    memberId,
    status: "checked-in",
    checkOutTime: null,
  }).populate("memberId", "firstName lastName membershipNumber")
}

attendanceSchema.statics.getMemberAttendanceStats = function (memberId, startDate, endDate) {
  const matchStage = {
    memberId: mongoose.Types.ObjectId(memberId),
    status: "checked-out",
  }

  if (startDate && endDate) {
    matchStage.checkInTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    }
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalDuration: { $sum: "$duration" },
        averageDuration: { $avg: "$duration" },
        longestSession: { $max: "$duration" },
        shortestSession: { $min: "$duration" },
      },
    },
  ])
}

attendanceSchema.statics.getDailyAttendanceReport = function (date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  return this.aggregate([
    {
      $match: {
        checkInTime: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      },
    },
    {
      $lookup: {
        from: "members",
        localField: "memberId",
        foreignField: "_id",
        as: "member",
      },
    },
    {
      $unwind: "$member",
    },
    {
      $group: {
        _id: null,
        totalCheckIns: { $sum: 1 },
        activeMembers: { $addToSet: "$memberId" },
        completedSessions: {
          $sum: { $cond: [{ $eq: ["$status", "checked-out"] }, 1, 0] },
        },
        totalDuration: {
          $sum: { $cond: [{ $eq: ["$status", "checked-out"] }, "$duration", 0] },
        },
      },
    },
    {
      $project: {
        totalCheckIns: 1,
        uniqueMembers: { $size: "$activeMembers" },
        completedSessions: 1,
        totalDuration: 1,
        averageDuration: {
          $cond: [{ $gt: ["$completedSessions", 0] }, { $divide: ["$totalDuration", "$completedSessions"] }, 0],
        },
      },
    },
  ])
}

// Instance methods
attendanceSchema.methods.checkOut = function (checkOutTime = new Date()) {
  this.checkOutTime = checkOutTime
  this.duration = Math.round((checkOutTime - this.checkInTime) / (1000 * 60))
  this.status = "checked-out"
  return this.save()
}

module.exports = mongoose.model("Attendance", attendanceSchema)
