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

    // Organize files by type/feature
    if (file.fieldname === "avatar" || file.fieldname === "profilePicture") {
      folder = "employees/profiles"
    } else if (file.fieldname === "membershipDocument") {
      folder = "employees/documents"
    } else if (file.fieldname === "paymentReceipt") {
      folder = "employees/receipts"
    } else if (file.fieldname === "employeeDocument") {
      folder = "employees/documents"
    }

    const fullPath = path.join(uploadDir, folder)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
    }

    cb(null, fullPath)
  },
  filename: (req, file, cb) => {
    // Generate unique but readable filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const extension = path.extname(file.originalname)
    
    // For employee avatars, use employee ID if available
    if ((file.fieldname === "avatar" || file.fieldname === "profilePicture") && req.body.employeeId) {
      cb(null, `employee-${req.body.employeeId}-${uniqueSuffix}${extension}`)
    } else {
      cb(null, file.fieldname + "-" + uniqueSuffix + extension)
    }
  },
})

// File filter with more specific rules
const fileFilter = (req, file, cb) => {
  // Define allowed types per field
  const allowedTypes = {
    "avatar": [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/gif",
      "image/webp"
    ],
    "profilePicture": [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/gif",
      "image/webp"
    ],
    "employeeDocument": [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain"
    ],
    "membershipDocument": [
      "application/pdf",
      "image/jpeg",
      "image/jpg", 
      "image/png"
    ],
    "paymentReceipt": [
      "application/pdf",
      "image/jpeg", 
      "image/jpg", 
      "image/png"
    ]
  }

  // Default allowed types for unspecified fields
  const defaultAllowed = [
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/gif",
    "application/pdf"
  ]

  // Check if field-specific restrictions exist
  const allowedMimes = allowedTypes[file.fieldname] || defaultAllowed
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${allowedMimes.join(", ")}`), false)
  }
}

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: Number.parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    
    // Field-specific size limits
    fileFilter: (req, file, cb) => {
      // Apply different size limits based on field
      const sizeLimits = {
        "avatar": 1 * 1024 * 1024, // 1MB for avatars
        "profilePicture": 1 * 1024 * 1024, // 1MB for profile pictures
        "employeeDocument": 10 * 1024 * 1024, // 10MB for documents
        "default": 5 * 1024 * 1024 // 5MB default
      }
      
      const limit = sizeLimits[file.fieldname] || sizeLimits["default"]
      
      if (file.size > limit) {
        return cb(new Error(`File too large. Maximum size for ${file.fieldname} is ${limit / (1024*1024)}MB`), false)
      }
      
      // Now check file type
      fileFilter(req, file, cb)
    }
  }
})

// Helper function to delete file
const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath)
      return true
    } catch (error) {
      console.error("Error deleting file:", error)
      return false
    }
  }
  return false
}

// Helper function to get file URL
const getFileUrl = (req, filePath) => {
  if (!filePath) return null
  
  // If it's already a URL, return as is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  
  // Convert local path to URL
  const relativePath = filePath.replace(uploadDir, '').replace(/\\/g, '/')
  return `${req.protocol}://${req.get('host')}/uploads${relativePath}`
}

// Specific middleware for employee avatar upload
const uploadEmployeeAvatar = upload.single('avatar')

// Middleware for employee documents (multiple files)
const uploadEmployeeDocuments = upload.array('documents', 5) // Max 5 documents

// Middleware for general file uploads
const uploadGeneral = upload.single('file')

module.exports = {
  upload,
  uploadEmployeeAvatar,
  uploadEmployeeDocuments,
  uploadGeneral,
  deleteFile,
  getFileUrl
}