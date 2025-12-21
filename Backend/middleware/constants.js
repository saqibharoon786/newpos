// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
}

// User Roles
const USER_ROLES = {
  ADMIN: "admin",
  RECEPTION: "reception",
}

// Member Status
const MEMBER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  EXPIRED: "expired",
}

// Payment Status
const PAYMENT_STATUS = {
  PAID: "paid",
  PENDING: "pending",
  OVERDUE: "overdue",
  FAILED: "failed",
}

// Subscription Status
const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  SUSPENDED: "suspended",
}

// Attendance Types
const ATTENDANCE_TYPE = {
  CHECK_IN: "check-in",
  CHECK_OUT: "check-out",
}

// Device Types
const DEVICE_TYPE = {
  ENTRY: "entry",
  EXIT: "exit",
  BOTH: "both",
}

// Invoice Status
const INVOICE_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
}

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
}

// File Upload Limits
const FILE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif"],
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
}

// Rate Limiting
const RATE_LIMITS = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
  },
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // login attempts per window
  },
  STRICT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // requests per window
  },
}

// JWT Settings
const JWT_SETTINGS = {
  ACCESS_TOKEN_EXPIRE: "1h",
  REFRESH_TOKEN_EXPIRE: "30d",
  RESET_TOKEN_EXPIRE: "10m",
}

// Notification Settings
const NOTIFICATION_TYPES = {
  SMS: "sms",
  EMAIL: "email",
  PUSH: "push",
}

module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  MEMBER_STATUS,
  PAYMENT_STATUS,
  SUBSCRIPTION_STATUS,
  ATTENDANCE_TYPE,
  DEVICE_TYPE,
  INVOICE_STATUS,
  PAGINATION,
  FILE_LIMITS,
  RATE_LIMITS,
  JWT_SETTINGS,
  NOTIFICATION_TYPES,
}
