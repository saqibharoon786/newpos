const multer = require("multer")
const path = require("path")
const fs = require("fs")

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || "./uploads"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "general"

    // Organize files by type
    if (file.fieldname === "profilePicture") {
      folder = "profiles"
    } else if (file.fieldname === "membershipDocument") {
      folder = "documents"
    } else if (file.fieldname === "paymentReceipt") {
      folder = "receipts"
    }

    const fullPath = path.join(uploadDir, folder)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
    }

    cb(null, fullPath)
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const extension = path.extname(file.originalname)
    cb(null, file.fieldname + "-" + uniqueSuffix + extension)
  },
})

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    "image/jpeg": true,
    "image/jpg": true,
    "image/png": true,
    "image/gif": true,
    "application/pdf": true,
    "application/msword": true,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  }

  if (allowedTypes[file.mimetype]) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, PDF, and DOC files are allowed."), false)
  }
}

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: Number.parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
  fileFilter: fileFilter,
})

module.exports = upload
