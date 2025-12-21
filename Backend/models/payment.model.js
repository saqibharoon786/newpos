const mongoose = require("mongoose")
const { generatePaymentId } = require("../utils/generateId");


const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      default: generatePaymentId
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Payment amount cannot be negative"],
    },
    paymentType: {
      type: String,
      enum: ["membership_fee", "registration_fee", "personal_training", "equipment_rental", "other"],
      required: true,
      default: "membership_fee",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "credit_card", "debit_card", "bank_transfer", "check", "online"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    transactionId: {
      type: String,
      default: null,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    periodCovered: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refundDetails: {
      refundAmount: {
        type: Number,
        default: 0,
      },
      refundDate: {
        type: Date,
        default: null,
      },
      refundReason: {
        type: String,
        default: null,
      },
      refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for payment status display
paymentSchema.virtual("statusDisplay").get(function () {
  const now = new Date()
  if (this.paymentStatus === "completed") {
    return "Paid"
  } else if (this.paymentStatus === "pending" && this.dueDate < now) {
    return "Overdue"
  } else if (this.paymentStatus === "pending") {
    return "Pending"
  } else {
    return this.paymentStatus.charAt(0).toUpperCase() + this.paymentStatus.slice(1)
  }
})

// Virtual for days overdue
paymentSchema.virtual("daysOverdue").get(function () {
  if (this.paymentStatus === "completed") return 0

  const now = new Date()
  const diffTime = now - this.dueDate
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays > 0 ? diffDays : 0
})

// Pre-save middleware to generate payment ID
paymentSchema.pre("save", async function (next) {
  if (this.isNew && !this.paymentId) {
    const count = await this.constructor.countDocuments()
    this.paymentId = `PAY${String(count + 1).padStart(8, "0")}`
  }
  next()
})

// Method to mark payment as completed
paymentSchema.methods.markAsCompleted = function (transactionId = null) {
  this.paymentStatus = "completed"
  this.paymentDate = new Date()
  if (transactionId) {
    this.transactionId = transactionId
  }
  return this.save()
}

// Method to process refund
paymentSchema.methods.processRefund = function (refundAmount, reason, refundedBy) {
  this.paymentStatus = "refunded"
  this.refundDetails.refundAmount = refundAmount
  this.refundDetails.refundDate = new Date()
  this.refundDetails.refundReason = reason
  this.refundDetails.refundedBy = refundedBy
  return this.save()
}

// Static method to get overdue payments
paymentSchema.statics.getOverduePayments = function () {
  const now = new Date()
  return this.find({
    paymentStatus: "pending",
    dueDate: { $lt: now },
  }).populate("member", "firstName lastName phone email")
}

module.exports = mongoose.model("Payment", paymentSchema)
