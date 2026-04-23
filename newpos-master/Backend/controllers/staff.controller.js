// const Staff = require("../models/staff.model")
// const logger = require("../loaders/logger")
// const { generateResponse } = require("../utils/response")

// // @desc    Create new staff member
// // @route   POST /api/staff
// // @access  Private (Admin only)
// const createStaff = async (req, res, next) => {
//   try {
//     const staffData = {
//       ...req.body,
//       addedBy: req.user.id,
//     }

//     const staff = await Staff.create(staffData)
//     await staff.populate("addedBy", "firstName lastName")

//     logger.info(`New staff member created: ${staff.fullName}`, {
//       staffId: staff._id,
//       position: staff.position,
//       department: staff.department,
//       createdBy: req.user.id,
//     })

//     res.status(201).json(
//       generateResponse(true, "Staff member created successfully", {
//         staff: {
//           id: staff._id,
//           staffId: staff.staffId,
//           firstName: staff.firstName,
//           lastName: staff.lastName,
//           fullName: staff.fullName,
//           email: staff.email,
//           phone: staff.phone,
//           position: staff.position,
//           department: staff.department,
//           salary: staff.salary,
//           salaryType: staff.salaryType,
//           hireDate: staff.hireDate,
//           isActive: staff.isActive,
//           createdAt: staff.createdAt,
//         },
//       }),
//     )
//   } catch (error) {
//     logger.error("Create staff error:", error)
//     next(error)
//   }
// }

// // @desc    Get all staff members
// // @route   GET /api/staff
// // @access  Private (Staff only)
// const getAllStaff = async (req, res, next) => {
//   try {
//     const page = Number.parseInt(req.query.page) || 1
//     const limit = Number.parseInt(req.query.limit) || 10
//     const skip = (page - 1) * limit

//     // Build filter object
//     const filter = {}
//     if (req.query.position) {
//       filter.position = req.query.position
//     }
//     if (req.query.department) {
//       filter.department = req.query.department
//     }
//     if (req.query.isActive !== undefined) {
//       filter.isActive = req.query.isActive === "true"
//     }
//     if (req.query.search) {
//       filter.$or = [
//         { firstName: { $regex: req.query.search, $options: "i" } },
//         { lastName: { $regex: req.query.search, $options: "i" } },
//         { email: { $regex: req.query.search, $options: "i" } },
//         { staffId: { $regex: req.query.search, $options: "i" } },
//       ]
//     }

//     const staff = await Staff.find(filter)
//       .populate("addedBy", "firstName lastName")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)

//     const total = await Staff.countDocuments(filter)

//     res.status(200).json(
//       generateResponse(true, "Staff members retrieved successfully", {
//         staff: staff.map((member) => ({
//           id: member._id,
//           staffId: member.staffId,
//           firstName: member.firstName,
//           lastName: member.lastName,
//           fullName: member.fullName,
//           email: member.email,
//           phone: member.phone,
//           age: member.age,
//           position: member.position,
//           department: member.department,
//           salary: member.salary,
//           salaryType: member.salaryType,
//           hireDate: member.hireDate,
//           yearsOfService: member.yearsOfService,
//           isActive: member.isActive,
//           addedBy: member.addedBy,
//           createdAt: member.createdAt,
//         })),
//         pagination: {
//           currentPage: page,
//           totalPages: Math.ceil(total / limit),
//           totalStaff: total,
//           hasNext: page < Math.ceil(total / limit),
//           hasPrev: page > 1,
//         },
//       }),
//     )
//   } catch (error) {
//     logger.error("Get all staff error:", error)
//     next(error)
//   }
// }

// // @desc    Get staff member by ID
// // @route   GET /api/staff/:id
// // @access  Private (Staff only)
// const getStaffById = async (req, res, next) => {
//   try {
//     const staff = await Staff.findById(req.params.id).populate("addedBy", "firstName lastName")

//     if (!staff) {
//       return res.status(404).json(generateResponse(false, "Staff member not found", null))
//     }

//     res.status(200).json(
//       generateResponse(true, "Staff member retrieved successfully", {
//         staff: {
//           id: staff._id,
//           staffId: staff.staffId,
//           firstName: staff.firstName,
//           lastName: staff.lastName,
//           fullName: staff.fullName,
//           email: staff.email,
//           phone: staff.phone,
//           dateOfBirth: staff.dateOfBirth,
//           age: staff.age,
//           gender: staff.gender,
//           address: staff.address,
//           emergencyContact: staff.emergencyContact,
//           position: staff.position,
//           department: staff.department,
//           salary: staff.salary,
//           salaryType: staff.salaryType,
//           hireDate: staff.hireDate,
//           yearsOfService: staff.yearsOfService,
//           workSchedule: staff.workSchedule,
//           qualifications: staff.qualifications,
//           profilePicture: staff.profilePicture,
//           isActive: staff.isActive,
//           terminationDate: staff.terminationDate,
//           terminationReason: staff.terminationReason,
//           addedBy: staff.addedBy,
//           notes: staff.notes,
//           createdAt: staff.createdAt,
//           updatedAt: staff.updatedAt,
//         },
//       }),
//     )
//   } catch (error) {
//     logger.error("Get staff by ID error:", error)
//     next(error)
//   }
// }

// // @desc    Update staff member
// // @route   PUT /api/staff/:id
// // @access  Private (Admin only)
// const updateStaff = async (req, res, next) => {
//   try {
//     const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//       runValidators: true,
//     }).populate("addedBy", "firstName lastName")

//     if (!staff) {
//       return res.status(404).json(generateResponse(false, "Staff member not found", null))
//     }

//     logger.info(`Staff member updated: ${staff.fullName}`, {
//       staffId: staff._id,
//       updatedBy: req.user.id,
//     })

//     res.status(200).json(
//       generateResponse(true, "Staff member updated successfully", {
//         staff: {
//           id: staff._id,
//           staffId: staff.staffId,
//           firstName: staff.firstName,
//           lastName: staff.lastName,
//           fullName: staff.fullName,
//           email: staff.email,
//           phone: staff.phone,
//           position: staff.position,
//           department: staff.department,
//           salary: staff.salary,
//           salaryType: staff.salaryType,
//           isActive: staff.isActive,
//           updatedAt: staff.updatedAt,
//         },
//       }),
//     )
//   } catch (error) {
//     logger.error("Update staff error:", error)
//     next(error)
//   }
// }

// // @desc    Terminate staff member
// // @route   PUT /api/staff/:id/terminate
// // @access  Private (Admin only)
// const terminateStaff = async (req, res, next) => {
//   try {
//     const { reason } = req.body
//     const staff = await Staff.findById(req.params.id)

//     if (!staff) {
//       return res.status(404).json(generateResponse(false, "Staff member not found", null))
//     }

//     await staff.terminate(reason)

//     logger.info(`Staff member terminated: ${staff.fullName}`, {
//       staffId: staff._id,
//       reason,
//       terminatedBy: req.user.id,
//     })

//     res.status(200).json(
//       generateResponse(true, "Staff member terminated successfully", {
//         staff: {
//           id: staff._id,
//           staffId: staff.staffId,
//           fullName: staff.fullName,
//           isActive: staff.isActive,
//           terminationDate: staff.terminationDate,
//           terminationReason: staff.terminationReason,
//         },
//       }),
//     )
//   } catch (error) {
//     logger.error("Terminate staff error:", error)
//     next(error)
//   }
// }

// // @desc    Add note to staff member
// // @route   POST /api/staff/:id/notes
// // @access  Private (Admin only)
// const addStaffNote = async (req, res, next) => {
//   try {
//     const { note } = req.body
//     const staff = await Staff.findById(req.params.id)

//     if (!staff) {
//       return res.status(404).json(generateResponse(false, "Staff member not found", null))
//     }

//     staff.notes.push({
//       note,
//       addedBy: req.user.id,
//     })

//     await staff.save()
//     await staff.populate("notes.addedBy", "firstName lastName")

//     logger.info(`Note added to staff member: ${staff.fullName}`, {
//       staffId: staff._id,
//       addedBy: req.user.id,
//     })

//     res.status(200).json(
//       generateResponse(true, "Note added successfully", {
//         note: staff.notes[staff.notes.length - 1],
//       }),
//     )
//   } catch (error) {
//     logger.error("Add staff note error:", error)
//     next(error)
//   }
// }

// module.exports = {
//   createStaff,
//   getAllStaff,
//   getStaffById,
//   updateStaff,
//   terminateStaff,
//   addStaffNote,
// }

 