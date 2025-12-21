/**
 * Generate standardized API response
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {any} meta - Additional metadata (pagination, etc.)
 * @returns {object} Standardized response object
 */
const generateResponse = (success, message, data = null, meta = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
  }

  if (data !== null) {
    response.data = data
  }

  if (meta !== null) {
    response.meta = meta
  }

  return response
}

/**
 * Generate error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {any} details - Additional error details
 * @returns {object} Error response object
 */
const generateErrorResponse = (message, statusCode = 500, details = null) => {
  const response = {
    success: false,
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
  }

  if (details !== null) {
    response.details = details
  }

  return response
}

/**
 * Generate pagination metadata
 * @param {number} currentPage - Current page number
 * @param {number} totalItems - Total number of items
 * @param {number} itemsPerPage - Items per page
 * @returns {object} Pagination metadata
 */
const generatePaginationMeta = (currentPage, totalItems, itemsPerPage) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  return {
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
    },
  }
}

const createResponse = generateResponse

module.exports = {
  generateResponse,
  generateErrorResponse,
  generatePaginationMeta,
  createResponse,
}
