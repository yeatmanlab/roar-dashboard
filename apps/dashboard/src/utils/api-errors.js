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
  if (response?.body?.error?.code && typeof response.body.error.code === 'string') {
    return response.body.error.code;
  }
  // Direct error object shape: { error: { code } }
  if (response?.error?.code && typeof response.error.code === 'string') {
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
  if (response?.body?.error?.message && typeof response.body.error.message === 'string') {
    return response.body.error.message;
  }
  if (response?.error?.message && typeof response.error.message === 'string') {
    return response.error.message;
  }
  if (response?.message && typeof response.message === 'string') {
    return response.message;
  }
  return null;
}

/**
 * Known API error codes that the frontend handles specifically.
 * Values match the backend's ApiErrorCode enum.
 */
export const API_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: 'auth/required',
  AUTH_TOKEN_EXPIRED: 'auth/token-expired',
  AUTH_ROSTERING_ENDED: 'auth/rostering-ended',
});

/**
 * Checks if the error indicates the user's rostering has ended.
 * @param {Object} error - ts-rest error response or error object
 * @returns {boolean}
 */
export function isRosteringEndedError(error) {
  return getApiErrorCode(error) === API_ERROR_CODES.AUTH_ROSTERING_ENDED;
}

/**
 * Checks if the error is a terminal auth error (not recoverable by retry).
 * Terminal auth at the app layer means the API client's retry already failed.
 * @param {Object} error - ts-rest error response or error object
 * @returns {boolean}
 */
export function isTerminalAuthError(error) {
  const code = getApiErrorCode(error);
  return code === API_ERROR_CODES.AUTH_REQUIRED || code === API_ERROR_CODES.AUTH_TOKEN_EXPIRED;
}
