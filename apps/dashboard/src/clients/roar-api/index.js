/**
 * Typed ts-rest API client for the ROAR backend.
 *
 * Reads authStore.accessToken synchronously on each request.
 * Retries once on 401 auth/token-expired by forcing a token refresh.
 */
import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-platform/api-contract';
import { useAuthStore } from '@/store/auth';
import { API_ERROR_CODES } from '@/utils/api-errors';

const ROAR_API_BASE_URL = import.meta.env.VITE_ROAR_API_BASE_URL;

/** @type {ReturnType<typeof initClient> | null} */
let clientInstance = null;

/**
 * Custom API function that injects the auth token and handles 401 retry.
 * Reads accessToken synchronously from the auth store.
 * On 401 with auth/token-expired, forces a token refresh and retries once.
 * Concurrent refreshes are deduplicated inside authStore.forceIdTokenRefresh.
 *
 * @param {Object} args - ts-rest API args
 * @returns {Promise<Response>} The response from the API
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

  // If 401 with token-expired, refresh and retry once
  if (response.status === 401) {
    let errorCode;
    try {
      const body = await response.clone().json();
      errorCode = body?.error?.code;
    } catch {
      // Unparseable body — nothing to interpret, surface the original 401.
      return response;
    }

    if (errorCode === API_ERROR_CODES.AUTH_TOKEN_EXPIRED) {
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
 * @throws {Error} If VITE_ROAR_API_BASE_URL is not set
 */
export function getRoarApiClient() {
  if (!clientInstance) {
    if (!ROAR_API_BASE_URL) {
      throw new Error('VITE_ROAR_API_BASE_URL is not set. ' + 'Add it to .env.development or .env.production.');
    }

    clientInstance = initClient(ApiContractV1, {
      baseUrl: ROAR_API_BASE_URL,
      baseHeaders: {},
      api: apiWithAuthRetry,
    });
  }

  return clientInstance;
}
