// const express = require("express")
// const {
//   createStaff,
//   getAllStaff,
//   getStaffById,
//   updateStaff,
//   terminateStaff,
//   addStaffNote,
// } = require("../controllers/staff.controller")
// const { authenticateToken, requireAdmin, requireStaff } = require("../middleware/passportAuth.middleware")
// const { staffValidation, validateObjectId, validatePagination } = require("../middleware/validation")
// const upload = require("../middleware/multer")

// const router = express.Router()

// // Apply authentication to all routes
// router.use(authenticateToken)

// // Staff viewing routes - Staff can view
// router.get("/get-staff", requireStaff, validatePagination, getAllStaff)
// router.get("/:id", requireStaff, validateObjectId("id"), getStaffById)

// // Staff management routes - Admin only
// router.post("/create-staff", requireAdmin, staffValidation.create, createStaff)
// router.put("/:id", requireAdmin, validateObjectId("id"), updateStaff)
// router.put("/:id/terminate", requireAdmin, validateObjectId("id"), terminateStaff)
// router.post("/:id/notes", requireAdmin, validateObjectId("id"), addStaffNote)

// // File upload routes - Admin only
// router.post(
//   "/:id/profile-picture",
//   requireAdmin,
//   validateObjectId("id"),
//   upload.single("profilePicture"),
//   (req, res) => {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         error: "No file uploaded",
//       })
//     }

//     res.status(200).json({
//       success: true,
//       message: "Profile picture uploaded successfully",
//       data: {
//         filename: req.file.filename,
//         path: req.file.path,
//         size: req.file.size,
//       },
//     })
//   },
// )

// router.post("/:id/certificates", requireAdmin, validateObjectId("id"), upload.array("certificates", 5), (req, res) => {
//   if (!req.files || req.files.length === 0) {
//     return res.status(400).json({
//       success: false,
//       error: "No files uploaded",
//     })
//   }

//   res.status(200).json({
//     success: true,
//     message: "Certificates uploaded successfully",
//     data: {
//       files: req.files.map((file) => ({
//         filename: file.filename,
//         path: file.path,
//         size: file.size,
//       })),
//     },
//   })
// })

// module.exports = router
