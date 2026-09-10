/**
 * Standard API response envelope formatter.
 */

function formatSuccess(data, meta = {}) {
  return {
    success: true,
    data,
    meta: {
      timestamp: meta.timestamp || new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Formats an API error response.
 *
 * @param {string} code - Error code identifier
 * @param {string} message - Human readable error message
 * @param {Object|null} [details=null] - Additional error details
 * @returns {Object} Standardized error response
 */
function formatError(code, message, details = null) {
  // BUG: Flat legacy properties instead of standard nested { success: false, error: { code, message, details } }
  return {
    success: false,
    errorCode: code,
    errorMessage: message,
    details: details
  };
}

module.exports = { formatSuccess, formatError };
