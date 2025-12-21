const crypto = require("crypto")

/**
 * Generate unique ID with prefix
 * @param {string} prefix - Prefix for the ID
 * @param {number} length - Length of the random part
 * @returns {string} Generated ID
 */
const generateId = (prefix = "", length = 8) => {
  const randomBytes = crypto.randomBytes(Math.ceil(length / 2))
  const randomString = randomBytes.toString("hex").slice(0, length).toUpperCase()
  return prefix ? `${prefix}${randomString}` : randomString
}

/**
 * Generate member ID
 * @returns {string} Member ID in format GYM######
 */
const generateMemberId = () => {
  const timestamp = Date.now().toString().slice(-6)
  const random = crypto.randomBytes(2).toString("hex").toUpperCase()
  return `GYM${timestamp}${random}`
}

/**
 * Generate staff ID
 * @returns {string} Staff ID in format STAFF####
 */
const generateStaffId = () => {
  const timestamp = Date.now().toString().slice(-4)
  const random = crypto.randomBytes(1).toString("hex").toUpperCase()
  return `STAFF${timestamp}${random}`
}

/**
 * Generate payment ID
 * @returns {string} Payment ID in format PAY########
 */
const generatePaymentId = () => {
  const timestamp = Date.now().toString().slice(-6)
  const random = crypto.randomBytes(3).toString("hex").toUpperCase()
  return `PAY${timestamp}${random}`
}

/**
 * Generate transaction ID
 * @returns {string} Transaction ID
 */
const generateTransactionId = () => {
  const timestamp = Date.now().toString()
  const random = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `TXN${timestamp}${random}`
}

/**
 * Generate secure token
 * @param {number} length - Token length in bytes
 * @returns {string} Secure token
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex")
}

module.exports = {
  generateId,
  generateMemberId,
  generateStaffId,
  generatePaymentId,
  generateTransactionId,
  generateSecureToken,
}



