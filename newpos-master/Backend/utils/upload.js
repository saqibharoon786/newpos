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
console.log("jhsdfkhkdhkdjfdfkljd lkdf ljdlkf k sdklf jlkdfj lkdfjlkjd ::", file)
    // Organize files by type/feature

    if (file.fieldname === "avatar" || file.fieldname === "profilePicture") {
      folder = "employees/profiles"
    } else if (file.fieldname === "cnicFrontImage" || file.fieldname === "cnicBackImage") {
      folder = "employees/cnic"
    } else if (file.fieldname === "membershipDocument" || file.fieldname === "employeeDocument") {
      folder = "employees/documents"
    } else if (file.fieldname === "paymentReceipt" || file.fieldname === "receipt") {
      // Check route to determine destination
      const url = req.originalUrl || req.baseUrl || '';
      if (url.includes('/assets') || url.includes('/create-assets') || url.includes('/receiptImage')) {
        folder = "assets/receipts"  // Assets receipts
      } else {
        folder = "employees/receipts"  // Employee receipts
      }
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
      cb(null, `employee-${req.body.employeeId}-avatar-${uniqueSuffix}${extension}`)
    } 
    // For CNIC images, include CNIC number if available
    else if ((file.fieldname === "cnicFrontImage" || file.fieldname === "cnicBackImage") && req.body.cnic) {
      const cnicType = file.fieldname === "cnicFrontImage" ? "front" : "back"
      cb(null, `employee-cnic-${req.body.cnic}-${cnicType}-${uniqueSuffix}${extension}`)
    }
    // For CNIC images without CNIC number
    else if (file.fieldname === "cnicFrontImage" || file.fieldname === "cnicBackImage") {
      const cnicType = file.fieldname === "cnicFrontImage" ? "front" : "back"
      const employeeId = req.body.employeeId || "unknown"
      cb(null, `employee-${employeeId}-cnic-${cnicType}-${uniqueSuffix}${extension}`)
    }
    // For ASSET receipts - IMPORTANT FIX HERE
    else if ((file.fieldname === "paymentReceipt" || file.fieldname === "receipt") && (req.body.invoiceNo || req.body.assetName)) {
      const invoiceNo = req.body.invoiceNo || req.body.assetName.replace(/\s+/g, '-').toLowerCase()
      cb(null, `asset-receipt-${invoiceNo}-${uniqueSuffix}${extension}`)
    }
    // For EMPLOYEE receipts
    else if ((file.fieldname === "paymentReceipt" || file.fieldname === "receipt") && req.body.employeeId) {
      cb(null, `employee-${req.body.employeeId}-receipt-${uniqueSuffix}${extension}`)
    }
    // For generic receipts
    else if (file.fieldname === "paymentReceipt" || file.fieldname === "receipt") {
      cb(null, `receipt-${uniqueSuffix}${extension}`)
    }
    else {
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
    "cnicFrontImage": [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/webp"
    ],
    "cnicBackImage": [
      "image/jpeg",
      "image/jpg", 
      "image/png",
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
      "image/png",
      "image/webp"
    ],
    "receipt": [
      "application/pdf",
      "image/jpeg", 
      "image/jpg", 
      "image/png",
      "image/webp"
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
  },
  fileFilter: (req, file, cb) => {
    // Apply different size limits based on field
    const sizeLimits = {
      "avatar": 2 * 1024 * 1024, // 2MB for avatars
      "profilePicture": 2 * 1024 * 1024, // 2MB for profile pictures
      "cnicFrontImage": 3 * 1024 * 1024, // 3MB for CNIC images
      "cnicBackImage": 3 * 1024 * 1024, // 3MB for CNIC images
      "employeeDocument": 10 * 1024 * 1024, // 10MB for documents
      "paymentReceipt": 5 * 1024 * 1024, // 5MB for payment receipts
      "receipt": 5 * 1024 * 1024, // 5MB for receipts
      "default": 5 * 1024 * 1024 // 5MB default
    }
    
    const limit = sizeLimits[file.fieldname] || sizeLimits["default"]
    
    if (file.size > limit) {
      return cb(new Error(`File too large. Maximum size for ${file.fieldname} is ${limit / (1024*1024)}MB`), false)
    }
    
    // Now check file type
    fileFilter(req, file, cb)
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

// Middleware for multiple employee file uploads (avatar + CNIC images)
const uploadEmployeeFiles = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cnicFrontImage', maxCount: 1 },
  { name: 'cnicBackImage', maxCount: 1 }
])

// Specific middleware for employee avatar upload (backward compatibility)
const uploadEmployeeAvatar = upload.single('avatar')

// Middleware for employee documents (multiple files)
const uploadEmployeeDocuments = upload.array('documents', 5) // Max 5 documents

// Middleware for receipt uploads
const uploadReceipt = upload.single('receipt')

// Middleware for payment receipt uploads (alternative name)
const uploadPaymentReceipt = upload.single('paymentReceipt')

// Middleware for general file uploads
const uploadGeneral = upload.single('file')

module.exports = {
  upload,
  uploadEmployeeFiles,
  uploadEmployeeAvatar,
  uploadEmployeeDocuments,
  uploadReceipt,
  uploadPaymentReceipt,
  uploadGeneral,
  deleteFile,
  getFileUrl
}