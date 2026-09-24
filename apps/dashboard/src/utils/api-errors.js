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
 * Auth values match the backend's ApiErrorCode enum; the `config/` namespace
 * is reserved for build-configuration failures raised in the browser before a
 * request is sent, so it can never collide with a server-sent code.
 */
export const API_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: 'auth/required',
  AUTH_TOKEN_EXPIRED: 'auth/token-expired',
  AUTH_ROSTERING_ENDED: 'auth/rostering-ended',
  AUTH_USER_NOT_FOUND: 'auth/user-not-found',
  /**
   * `getRoarApiClient()` could not build the client because
   * `VITE_ROAR_API_BASE_URL` is missing from the build. Client-side only —
   * no request ever leaves the browser, so it can never succeed on retry.
   */
  CONFIG_BASE_URL_MISSING: 'config/base-url-missing',
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

/**
 * Checks if the error indicates the caller's Firebase account has no backend
 * user record yet (401 `auth/user-not-found` from the auth guard).
 *
 * This is the provisioning signal: right after an SSO sign-in the Firebase
 * account exists but the backend user record is still being created by
 * rostering, so `/me` fails with this code until provisioning completes.
 * Consumers treat it as transient and retry with a patient backoff instead
 * of surfacing an error.
 *
 * @param {Object} error - ts-rest error response or error object
 * @returns {boolean}
 */
export function isUserNotProvisionedError(error) {
  return getApiErrorCode(error) === API_ERROR_CODES.AUTH_USER_NOT_FOUND;
}

/**
 * Checks if the error is the missing-base-URL configuration failure raised by
 * `getRoarApiClient()`.
 *
 * Terminal for the whole page load: the base URL comes from the build, so it
 * cannot appear between attempts. Retrying only delays the error UI, which is
 * why both the queryClient's default retry policy and `meRetryPolicy`
 * short-circuit on it.
 *
 * @param {Object} error - Error thrown by the API client
 * @returns {boolean}
 */
export function isMissingBaseUrlError(error) {
  return getApiErrorCode(error) === API_ERROR_CODES.CONFIG_BASE_URL_MISSING;
}
