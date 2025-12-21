const mongoose = require("mongoose")

const attendanceDeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, "Device ID is required"],
      unique: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Device name is required"],
      trim: true,
      maxlength: [100, "Device name cannot exceed 100 characters"],
    },
    location: {
      type: String,
      required: [true, "Device location is required"],
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"],
    },
    type: {
      type: String,
      enum: ["entry", "exit", "both"],
      required: true,
      default: "both",
    },
    ipAddress: {
      type: String,
      required: [true, "IP address is required"],
      match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, "Please enter a valid IP address"],
    },
    port: {
      type: Number,
      required: [true, "Port is required"],
      min: [1, "Port must be greater than 0"],
      max: [65535, "Port must be less than 65536"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },
    firmware: {
      type: String,
      default: null,
    },
    settings: {
      timeout: {
        type: Number,
        default: 5000, // 5 seconds
      },
      retryAttempts: {
        type: Number,
        default: 3,
      },
      enableLogging: {
        type: Boolean,
        default: true,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for device status
attendanceDeviceSchema.virtual("status").get(function () {
  if (!this.isActive) return "inactive"

  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

  if (this.lastHeartbeat && this.lastHeartbeat > fiveMinutesAgo) {
    return "online"
  }
  return "offline"
})

// Method to update heartbeat
attendanceDeviceSchema.methods.updateHeartbeat = function () {
  this.lastHeartbeat = new Date()
  return this.save()
}

module.exports = mongoose.model("AttendanceDevice", attendanceDeviceSchema)
