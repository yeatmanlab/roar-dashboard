/**
 * Typed ts-rest API client for the ROAR backend.
 *
 * Reads authStore.accessToken synchronously on each request.
 * Retries once on 401 auth/token-expired or auth/token-invalid by forcing a token refresh.
 */
import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-platform/api-contract';
import { useAuthStore } from '@/store/auth';
import { API_ERROR_CODES, getApiErrorCode } from '@/utils/api-errors';

const ROAR_API_BASE_URL = import.meta.env.VITE_ROAR_API_BASE_URL;

/** @type {ReturnType<typeof initClient> | null} */
let clientInstance = null;

/**
 * Custom API function that injects the auth token and handles 401 retry.
 * Reads accessToken synchronously from the auth store.
 * On 401 with auth/token-expired or auth/token-invalid, forces a token refresh
 * and retries once.
 * Concurrent refreshes are deduplicated inside authStore.forceIdTokenRefresh.
 *
 * @param {Object} args - ts-rest API args
 * @returns {Promise<{status: number, body: unknown, headers: Headers}>} The parsed
 *   ts-rest result — NOT a fetch Response (no clone()/json() methods).
 */
async function apiWithAuthRetry(args) {
  const authStore = useAuthStore();

  // First attempt with current token
  const token = authStore.accessToken;
  const headers = {
    ...args.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await tsRestFetchApi({ ...args, headers });

  // If 401 with an expired or invalid token, refresh and retry once. Invalid
  // gets the same treatment as expired: it can mean a corrupted client-side
  // token while the Firebase session is healthy, which one forced refresh
  // repairs. A dead session fails the retry too, and that second 401 is what
  // the app layer treats as terminal (see isTerminalAuthError).
  //
  // `tsRestFetchApi` resolves to a plain `{ status, body, headers }` object
  // with the JSON body already parsed — NOT a fetch Response. The error code
  // is read straight off `response.body`; a non-JSON body (string/blob)
  // yields undefined and falls through to the original 401.
  if (response.status === 401) {
    const errorCode = getApiErrorCode(response);

    if (errorCode === API_ERROR_CODES.AUTH_TOKEN_EXPIRED || errorCode === API_ERROR_CODES.AUTH_TOKEN_INVALID) {
      let freshToken;
      try {
        freshToken = await authStore.forceIdTokenRefresh();
      } catch {
        // The refresh itself failed (e.g. revoked session). Surface the
        // original 401 so callers see a terminal auth error, not a thrown
        // refresh internal.
        freshToken = null;
      }
      // No fresh token (signed out mid-request): a retry without an
      // Authorization header is a guaranteed 401 — skip the round-trip.
      if (!freshToken) return response;

      // Retry once with the fresh token. A failure here propagates as a
      // network error instead of masquerading as a terminal auth 401.
      return tsRestFetchApi({
        ...args,
        headers: { ...args.headers, Authorization: `Bearer ${freshToken}` },
      });
    }
  }

  return response;
}

/**
 * Returns the singleton ROAR API client.
 * Creates the client on first call (lazy initialization).
 *
 * @returns {ReturnType<typeof initClient>} Typed ts-rest client
 * @throws {Error} If VITE_ROAR_API_BASE_URL is not set or is not a bare
 *   origin. The error carries `code: 'config/base-url-missing'` or
 *   `code: 'config/base-url-invalid'` so `isBaseUrlConfigError` can classify
 *   it without matching on the message text.
 */
export function getRoarApiClient() {
  if (!clientInstance) {
    if (!ROAR_API_BASE_URL) {
      const error = new Error('VITE_ROAR_API_BASE_URL is not set.');
      // Tag the error so retry policies and the global-error bridge can
      // recognize it. The base URL is baked in at build time, so this can
      // never resolve itself between attempts — retrying is pure delay.
      error.code = API_ERROR_CODES.CONFIG_BASE_URL_MISSING;
      throw error;
    }

    // The base URL must be a bare origin: the contract applies its own /v1
    // pathPrefix, so a configured path (typically a trailing /v1) silently
    // doubles into /v1/v1/... requests that 404 on every endpoint.
    let baseUrl;
    try {
      baseUrl = new URL(ROAR_API_BASE_URL);
    } catch {
      const error = new Error(`VITE_ROAR_API_BASE_URL is not a valid URL: ${ROAR_API_BASE_URL}`);
      error.code = API_ERROR_CODES.CONFIG_BASE_URL_INVALID;
      throw error;
    }
    if (baseUrl.pathname !== '/' || baseUrl.search !== '' || baseUrl.hash !== '' || ROAR_API_BASE_URL.endsWith('/')) {
      const error = new Error(
        `VITE_ROAR_API_BASE_URL must be an origin with no path, query, hash, or trailing slash (the contract adds /v1): ${ROAR_API_BASE_URL}`,
      );
      error.code = API_ERROR_CODES.CONFIG_BASE_URL_INVALID;
      throw error;
    }

    clientInstance = initClient(ApiContractV1, {
      baseUrl: ROAR_API_BASE_URL,
      baseHeaders: {},
      api: apiWithAuthRetry,
    });
  }

  return clientInstance;
}
