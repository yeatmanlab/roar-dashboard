/**
 * Utilities for extracting error information from ts-rest API responses.
 */

/**
 * Extracts the error code from a ts-rest error response.
 * Accepts the full ts-rest result (`{ status, body }`) or just the body/error object.
 *
 * @param {Object} response - Full ts-rest result, response body, or error object
 * @returns {string | null} The error code, or null if not present
 */
export function getApiErrorCode(response) {
  // ts-rest error envelope shape: { status, body: { error: { code, message } } }
  if (response?.body?.error?.code) {
    return response.body.error.code;
  }
  // Direct error object shape: { error: { code } }
  if (response?.error?.code) {
    return response.error.code;
  }
  // Plain code
  if (response?.code && typeof response.code === 'string') {
    return response.code;
  }
  return null;
}

/**
 * Extracts the error message from a ts-rest error response.
 * Accepts the full ts-rest result (`{ status, body }`) or just the body/error object.
 *
 * @param {Object} response - Full ts-rest result, response body, or error object
 * @returns {string | null} The error message, or null if not present
 */
export function getApiErrorMessage(response) {
  if (response?.body?.error?.message) {
    return response.body.error.message;
  }
  if (response?.error?.message) {
    return response.error.message;
  }
  if (response?.message && typeof response.message === 'string') {
    return response.message;
  }
  return null;
}
