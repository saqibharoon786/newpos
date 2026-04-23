// models/member.model.js
const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: String, unique: true, uppercase: true },

    firstName: {
      type: String,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
    },

    phone: {
      type: String,

    },

    dateOfBirth: { type: Date,  },

    gender: { type: String, enum: ["male", "female", "other"] },

    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String },
    },

    emergencyContact: {
      name: { type: String },
      phone: { type: String },
      relationship: { type: String },
    },

    membershipType: {
      type: String,
      enum: ["basic", "premium", "vip"],
      default: "basic",
    },

    membershipStartDate: { type: Date, default: Date.now },
    membershipEndDate: { type: Date },

    monthlyFee: { type: Number, min: [0, "Monthly fee cannot be negative"] },

    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "overdue"],
      default: "paid",
    },

    lastPaymentDate: { type: Date, default: null },
    nextPaymentDue: { type: Date },

    doorAccessEnabled: { type: Boolean, default: true },

    profilePicture: { type: String, default: null },
    medicalConditions: { type: String, default: "" },
    fitnessGoals: { type: String, default: "" },
    isActive: { type: Boolean, default: true },

    // ✅ only createdBy now
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    notes: [
      {
        note: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ---------------- Virtuals ---------------- */
memberSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

memberSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return undefined;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
});

memberSchema.virtual("membershipStatus").get(function () {
  const now = new Date();
  const end = this.membershipEndDate ? new Date(this.membershipEndDate) : null;
  const nextDue = this.nextPaymentDue ? new Date(this.nextPaymentDue) : null;

  if (end && end < now) return "expired";
  if (nextDue && nextDue < now && this.paymentStatus !== "paid")
    return "payment_overdue";
  return "active";
});

/* ---------------- Helpers ---------------- */
function computePaymentStatus(doc) {
  const now = new Date();
  const due = doc.nextPaymentDue ? new Date(doc.nextPaymentDue) : null;
  const lastPaid = doc.lastPaymentDate ? new Date(doc.lastPaymentDate) : null;

  if (!due) return doc.paymentStatus || "paid";
  if (lastPaid && lastPaid >= due) return "paid";
  if (now > due) return "overdue";
  return "unpaid";
}

/* ---------------- Hooks ---------------- */
memberSchema.pre("save", async function (next) {
  if (this.isNew && !this.memberId) {
    const count = await this.constructor.countDocuments();
    this.memberId = `GYM${String(count + 1).padStart(6, "0")}`;
  }
  this.paymentStatus = computePaymentStatus(this);
  next();
});

memberSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() || {};
  if (
    update.nextPaymentDue != null ||
    update.lastPaymentDate != null ||
    (update.$set &&
      ("nextPaymentDue" in update.$set || "lastPaymentDate" in update.$set))
  ) {
    const current = await this.model.findOne(this.getQuery());
    if (current) {
      const merged = {
        ...current.toObject(),
        ...(update.$set || {}),
        ...update,
      };
      delete merged.$set;
      const newStatus = computePaymentStatus(merged);
      if (!update.$set) update.$set = {};
      update.$set.paymentStatus = newStatus;
      this.setUpdate(update);
    }
  }
  next();
});

/* ---------------- Methods ---------------- */
memberSchema.methods.isPaymentOverdue = function () {
  if (!this.nextPaymentDue) return false;
  const now = new Date();
  const gracePeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
  return now - new Date(this.nextPaymentDue) > gracePeriod;
};

memberSchema.methods.disableDoorAccess = function () {
  this.doorAccessEnabled = false;
  return this.save();
};

memberSchema.methods.enableDoorAccess = function () {
  this.doorAccessEnabled = true;
  return this.save();
};

// Safe export
module.exports = mongoose.model("Member", memberSchema);
