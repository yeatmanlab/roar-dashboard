/**
 * Utilities for extracting error information from ts-rest API responses.
 */

/**
 * Extracts the error code from a ts-rest error response.
 * Handles both the envelope shape ({ error: { code } }) and direct error objects.
 *
 * @param {Object} error - The error response body or error object
 * @returns {string | null} The error code, or null if not present
 */
export function getApiErrorCode(error) {
  // ts-rest error envelope shape: { status, body: { error: { code, message } } }
  if (error?.body?.error?.code) {
    return error.body.error.code;
  }
  // Direct error object shape
  if (error?.error?.code) {
    return error.error.code;
  }
  // Plain code
  if (error?.code && typeof error.code === 'string') {
    return error.code;
  }
  return null;
}

/**
 * Extracts the error message from a ts-rest error response.
 *
 * @param {Object} error - The error response body or error object
 * @returns {string | null} The error message, or null if not present
 */
export function getApiErrorMessage(error) {
  if (error?.body?.error?.message) {
    return error.body.error.message;
  }
  if (error?.error?.message) {
    return error.error.message;
  }
  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }
  return null;
}
