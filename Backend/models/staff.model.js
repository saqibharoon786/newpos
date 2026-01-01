// const mongoose = require("mongoose")

// const staffSchema = new mongoose.Schema(
//   {
//     staffId: {
//       type: String,
//       required: true,
//       unique: true,
//       uppercase: true,
//     },
//     firstName: {
//       type: String,
//       required: [true, "First name is required"],
//       trim: true,
//       maxlength: [50, "First name cannot exceed 50 characters"],
//     },
//     lastName: {
//       type: String,
//       required: [true, "Last name is required"],
//       trim: true,
//       maxlength: [50, "Last name cannot exceed 50 characters"],
//     },
//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       unique: true,
//       lowercase: true,
//       match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
//     },

//     phone: {
//       type: String,
//       required: [true, "Phone number is required"],
//       match: [/^\+?[\d\s-()]+$/, "Please enter a valid phone number"],
//     },
//     dateOfBirth: {
//       type: Date,
//       required: [true, "Date of birth is required"],
//     },
//     gender: {
//       type: String,
//       enum: ["male", "female", "other"],
//       required: true,
//     },
//     address: {
//       street: { type: String, required: true },
//       city: { type: String, required: true },
//       state: { type: String, required: true },
//       zipCode: { type: String, required: true },
//       country: { type: String, default: "USA" },
//     },
//     position: {
//       type: String,
//       required: true,
//       enum: ["trainer", "receptionist", "cleaner", "maintenance", "manager", "nutritionist"],
//     },
//     department: {
//       type: String,
//       required: true,
//       enum: ["fitness", "administration", "maintenance", "nutrition"],
//     },
//     salary: {
//       type: Number,
//       required: true,
//       min: [0, "Salary cannot be negative"],
//     },
//     salaryType: {
//       type: String,
//       enum: ["hourly", "monthly", "yearly"],
//       default: "monthly",
//     },
//     hireDate: {
//       type: Date,
//       required: true,
//       default: Date.now,
//     },
//     workSchedule: {
//       monday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
//       tuesday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
//       wednesday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
//       thursday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
//       friday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
//       saturday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
//       sunday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
//     },
//     qualifications: [
//       {
//         title: String,
//         institution: String,
//         year: Number,
//         certificateUrl: String,
//       },
//     ],
//     emergencyContact: {
//       name: { type: String, required: true },
//       phone: { type: String, required: true },
//       relationship: { type: String, required: true },
//     },
//     profilePicture: {
//       type: String,
//       default: null,
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//     terminationDate: {
//       type: Date,
//       default: null,
//     },
//     terminationReason: {
//       type: String,
//       default: null,
//     },
//     addedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     notes: [
//       {
//         note: String,
//         addedBy: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "User",
//         },
//         addedAt: {
//           type: Date,
//           default: Date.now,
//         },
//       },
//     ],
//   },
//   {
//     timestamps: true,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true },
//   },
// )

// // Virtual for full name
// staffSchema.virtual("fullName").get(function () {
//   return `${this.firstName} ${this.lastName}`
// })

// // Virtual for age
// staffSchema.virtual("age").get(function () {
//   const today = new Date()
//   const birthDate = new Date(this.dateOfBirth)
//   let age = today.getFullYear() - birthDate.getFullYear()
//   const monthDiff = today.getMonth() - birthDate.getMonth()

//   if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
//     age--
//   }

//   return age
// })

// // Virtual for years of service
// staffSchema.virtual("yearsOfService").get(function () {
//   const today = new Date()
//   const hireDate = new Date(this.hireDate)
//   return Math.floor((today - hireDate) / (365.25 * 24 * 60 * 60 * 1000))
// })

// // Pre-save middleware to generate staff ID
// staffSchema.pre("save", async function (next) {
//   if (this.isNew && !this.staffId) {
//     const count = await this.constructor.countDocuments()
//     this.staffId = `STAFF${String(count + 1).padStart(4, "0")}`
//   }
//   next()
// })

// // Method to terminate staff
// staffSchema.methods.terminate = function (reason) {
//   this.isActive = false
//   this.terminationDate = new Date()
//   this.terminationReason = reason
//   return this.save()
// }

// module.exports = mongoose.model("Staff", staffSchema)
