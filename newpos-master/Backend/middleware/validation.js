// src/middleware/validators.js
const { body, param, query, validationResult } = require("express-validator");
const { createResponse } = require("../utils/response");

// ────────────────────────────────────────────────────────────
// Validation result handler
// ────────────────────────────────────────────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    return res
      .status(400)
      .json(createResponse(false, "Validation failed", null, errorMessages));
  }
  next();
};

// ────────────────────────────────────────────────────────────
// Common validation rules
// ────────────────────────────────────────────────────────────
const commonValidations = {
  email: body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  password: body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),

  phone: body("phone")
    // Use "en-PK" to be strict for Pakistani numbers; use "any" if you want broader acceptance
    .isMobilePhone("en-PK")
    .withMessage("Please provide a valid phone number"),

  name: (field) =>
    body(field)
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage(`${field} must be between 2 and 50 characters`)
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage(`${field} must contain only letters and spaces`),

  mongoId: (field) =>
    param(field).isMongoId().withMessage(`Invalid ${field} format`),

  positiveNumber: (field) =>
    body(field)
      .isFloat({ min: 0 })
      .withMessage(`${field} must be a positive number`),

  date: (field) =>
    body(field).isISO8601().withMessage(`${field} must be a valid date`),

  pagination: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
};

// ────────────────────────────────────────────────────────────
// Quick helpers
// ────────────────────────────────────────────────────────────
const validateObjectId = (paramName) => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors,
];

const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  handleValidationErrors,
];

// ────────────────────────────────────────────────────────────
/** USER VALIDATION */
// ────────────────────────────────────────────────────────────
const userValidation = {
  register: [
    commonValidations.email,
    commonValidations.password,
    commonValidations.name("firstName"),
    commonValidations.name("lastName"),
    commonValidations.phone,
    body("role")
      .optional()
      .isIn(["admin", "reception"])
      .withMessage("Role must be either admin or reception"),
    handleValidationErrors,
  ],

  login: [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
    handleValidationErrors,
  ],

  updateProfile: [
    commonValidations.name("firstName").optional(),
    commonValidations.name("lastName").optional(),
    commonValidations.phone.optional(),
    handleValidationErrors,
  ],

  getById: [param("id").isMongoId().withMessage("Invalid user id"), handleValidationErrors],

  update: [
    param("id").isMongoId().withMessage("Invalid user id"),
    commonValidations.name("firstName").optional(),
    commonValidations.name("lastName").optional(),
    commonValidations.phone.optional(),
    body("username")
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be 3–30 chars"),
    body("role")
      .optional()
      .isIn(["admin", "reception"])
      .withMessage("Role must be either admin or reception"),
    handleValidationErrors,
  ],
};

// ────────────────────────────────────────────────────────────
/** STAFF VALIDATION — matches your Staff model exactly */
// ────────────────────────────────────────────────────────────
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayKeys = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const positions = ["trainer", "receptionist", "cleaner", "maintenance", "manager", "nutritionist"];
const departments = ["fitness", "administration", "maintenance", "nutrition"];

const staffValidation = {
  create: [
    // Required names
    commonValidations.name("firstName"),
    commonValidations.name("lastName"),

    // Required core contact
    body("email").isEmail().withMessage("Email is required and must be valid").normalizeEmail(),
    body("phone").isMobilePhone("en-PK").withMessage("Phone must be a valid Pakistani mobile number"),

    // Required dates / enums / numbers
    body("dateOfBirth").isISO8601().withMessage("dateOfBirth must be a valid date"),
    body("gender").isIn(["male","female","other"]).withMessage("Gender must be male, female, or other"),

    body("position").isIn(positions)
      .withMessage(`Position must be one of: ${positions.join(", ")}`),

    body("department").isIn(departments)
      .withMessage(`Department must be one of: ${departments.join(", ")}`),

    commonValidations.positiveNumber("salary"),
    body("salaryType")
      .optional()
      .isIn(["hourly","monthly","yearly"])
      .withMessage("salaryType must be hourly, monthly, or yearly"),

    body("hireDate").isISO8601().withMessage("hireDate must be a valid date"),

    // Address object (required fields)
    body("address").isObject().withMessage("address must be an object"),
    body("address.street").isString().notEmpty().withMessage("address.street is required"),
    body("address.city").isString().notEmpty().withMessage("address.city is required"),
    body("address.state").isString().notEmpty().withMessage("address.state is required"),
    body("address.zipCode").isString().notEmpty().withMessage("address.zipCode is required"),
    body("address.country").optional().isString().withMessage("address.country must be a string"),

    // Emergency contact object (required)
    body("emergencyContact").isObject().withMessage("emergencyContact must be an object"),
    body("emergencyContact.name").isString().isLength({ min: 2, max: 100 })
      .withMessage("emergencyContact.name must be 2–100 chars"),
    body("emergencyContact.relationship").isString().isLength({ min: 2, max: 50 })
      .withMessage("emergencyContact.relationship must be 2–50 chars"),
    body("emergencyContact.phone").isMobilePhone("en-PK")
      .withMessage("emergencyContact.phone must be a valid Pakistani mobile number"),

    // Qualifications: array of objects
    body("qualifications").optional().isArray().withMessage("qualifications must be an array"),
    body("qualifications.*.title").optional().isString().isLength({ min: 2, max: 120 })
      .withMessage("qualification.title must be 2–120 chars"),
    body("qualifications.*.institution").optional().isString().isLength({ min: 2, max: 120 })
      .withMessage("qualification.institution must be 2–120 chars"),
    body("qualifications.*.year").optional().isInt({ min: 1900, max: 3000 })
      .withMessage("qualification.year must be a valid year"),
    body("qualifications.*.certificateUrl").optional().isURL()
      .withMessage("qualification.certificateUrl must be a valid URL"),

    // workSchedule: object with day keys
    body("workSchedule").optional().isObject().withMessage("workSchedule must be an object"),
    ...dayKeys.flatMap((d) => ([
      body(`workSchedule.${d}.isWorking`).optional().isBoolean().withMessage(`${d}.isWorking must be boolean`),
      body(`workSchedule.${d}.start`).optional().matches(HHMM).withMessage(`${d}.start must be HH:mm`),
      body(`workSchedule.${d}.end`).optional().matches(HHMM).withMessage(`${d}.end must be HH:mm`),
    ])),
    ...dayKeys.map((d) =>
      body(`workSchedule.${d}`).optional().custom((val) => {
        if (!val) return true;
        if (val.isWorking === true) {
          if (!HHMM.test(val.start || "")) throw new Error(`${d}.start must be HH:mm when working`);
          if (!HHMM.test(val.end || "")) throw new Error(`${d}.end must be HH:mm when working`);
        }
        return true;
      })
    ),

    // Misc
    body("profilePicture").optional().isURL().withMessage("profilePicture must be a valid URL"),
    body("isActive").optional().isBoolean().withMessage("isActive must be boolean"),

    handleValidationErrors,
  ],

  update: [
    commonValidations.mongoId("id"),

    commonValidations.name("firstName").optional(),
    commonValidations.name("lastName").optional(),

    body("email").optional().isEmail().withMessage("email must be valid").normalizeEmail(),
    body("phone").optional().isMobilePhone("en-PK").withMessage("phone must be valid"),

    body("dateOfBirth").optional().isISO8601().withMessage("dateOfBirth must be a valid date"),
    body("gender").optional().isIn(["male","female","other"]).withMessage("Gender must be male, female, or other"),

    body("position").optional().isIn(positions)
      .withMessage(`Position must be one of: ${positions.join(", ")}`),

    body("department").optional().isIn(departments)
      .withMessage(`Department must be one of: ${departments.join(", ")}`),

    commonValidations.positiveNumber("salary").optional(),
    body("salaryType").optional().isIn(["hourly","monthly","yearly"])
      .withMessage("salaryType must be hourly, monthly, or yearly"),

    body("hireDate").optional().isISO8601().withMessage("hireDate must be a valid date"),

    body("address").optional().isObject().withMessage("address must be an object"),
    body("address.street").optional().isString().notEmpty().withMessage("address.street cannot be empty"),
    body("address.city").optional().isString().notEmpty().withMessage("address.city cannot be empty"),
    body("address.state").optional().isString().notEmpty().withMessage("address.state cannot be empty"),
    body("address.zipCode").optional().isString().notEmpty().withMessage("address.zipCode cannot be empty"),
    body("address.country").optional().isString(),

    body("emergencyContact").optional().isObject().withMessage("emergencyContact must be an object"),
    body("emergencyContact.name").optional().isString().isLength({ min: 2, max: 100 }),
    body("emergencyContact.relationship").optional().isString().isLength({ min: 2, max: 50 }),
    body("emergencyContact.phone").optional().isMobilePhone("en-PK"),

    body("qualifications").optional().isArray().withMessage("qualifications must be an array"),
    body("qualifications.*.title").optional().isString().isLength({ min: 2, max: 120 }),
    body("qualifications.*.institution").optional().isString().isLength({ min: 2, max: 120 }),
    body("qualifications.*.year").optional().isInt({ min: 1900, max: 3000 }),
    body("qualifications.*.certificateUrl").optional().isURL(),

    body("workSchedule").optional().isObject().withMessage("workSchedule must be an object"),
    ...dayKeys.flatMap((d) => ([
      body(`workSchedule.${d}.isWorking`).optional().isBoolean(),
      body(`workSchedule.${d}.start`).optional().matches(HHMM).withMessage(`${d}.start must be HH:mm`),
      body(`workSchedule.${d}.end`).optional().matches(HHMM).withMessage(`${d}.end must be HH:mm`),
    ])),
    ...dayKeys.map((d) =>
      body(`workSchedule.${d}`).optional().custom((val) => {
        if (!val) return true;
        if (val.isWorking === true) {
          if (!HHMM.test(val.start || "")) throw new Error(`${d}.start must be HH:mm when working`);
          if (!HHMM.test(val.end || "")) throw new Error(`${d}.end must be HH:mm when working`);
        }
        return true;
      })
    ),

    body("profilePicture").optional().isURL(),
    body("isActive").optional().isBoolean(),

    handleValidationErrors,
  ],

  getById: [commonValidations.mongoId("id"), handleValidationErrors],

  list: [
    ...commonValidations.pagination,
    query("position").optional().isIn(positions),
    query("department").optional().isIn(departments),
    query("isActive")
      .optional()
      .isIn(["true", "false"])
      .withMessage("isActive must be true or false"),
    query("search").optional().isString(),
    handleValidationErrors,
  ],
};

// ────────────────────────────────────────────────────────────
/** MEMBER VALIDATION (unchanged) */
// ────────────────────────────────────────────────────────────
const memberValidation = {
  create: [
    commonValidations.name("firstName"),
    commonValidations.name("lastName"),
    commonValidations.email,
    commonValidations.phone,
    commonValidations.date("dateOfBirth"),
    body("gender")
      .isIn(["male", "female", "other"])
      .withMessage("Gender must be male, female, or other"),
    body("membershipType")
      .isIn(["basic", "premium", "vip"])
      .withMessage("Membership type must be basic, premium, or vip"),
    commonValidations.positiveNumber("monthlyFee"),
    commonValidations.date("membershipEndDate"),
    handleValidationErrors,
  ],

  update: [
    commonValidations.mongoId("id"),
    commonValidations.name("firstName").optional(),
    commonValidations.name("lastName").optional(),
    commonValidations.email.optional(),
    commonValidations.phone.optional(),
    body("membershipType")
      .optional()
      .isIn(["basic", "premium", "vip"])
      .withMessage("Membership type must be basic, premium, or vip"),
    handleValidationErrors,
  ],

  getById: [commonValidations.mongoId("id"), handleValidationErrors],
};

// ────────────────────────────────────────────────────────────
/** PLAN VALIDATION (unchanged) */
// ────────────────────────────────────────────────────────────
const planValidation = {
  create: [
    body("name")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Plan name must be between 2 and 100 characters"),
    body("description")
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage("Description must be between 10 and 500 characters"),
    commonValidations.positiveNumber("price"),
    body("duration.value")
      .isInt({ min: 1 })
      .withMessage("Duration value must be a positive integer"),
    body("duration.unit")
      .isIn(["days", "weeks", "months", "years"])
      .withMessage("Duration unit must be days, weeks, months, or years"),
    handleValidationErrors,
  ],
};

// ────────────────────────────────────────────────────────────
/** ATTENDANCE VALIDATION (unchanged) */
// ────────────────────────────────────────────────────────────
const attendanceValidation = {
  checkIn: [
    commonValidations.mongoId("memberId"),
    body("deviceId").notEmpty().withMessage("Device ID is required"),
    body("method")
      .optional()
      .isIn(["card", "biometric", "mobile", "manual"])
      .withMessage("Method must be card, biometric, mobile, or manual"),
    handleValidationErrors,
  ],
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  userValidation,
  memberValidation,
  planValidation,
  attendanceValidation,
  staffValidation,
  validateObjectId,
  validatePagination,
};
