const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username cannot exceed 30 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "reception"],
      default: "reception",
      required: true,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^\+?[\d\s-()]+$/, "Please enter a valid phone number"],
    },
    profilePicture: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    refreshToken: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()
  try {
    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
    this.password = await bcrypt.hash(this.password, saltRounds)
    next()
  } catch (error) {
    next(error)
  }
})

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date()
  return this.save()
}

module.exports = mongoose.model("User", userSchema)
