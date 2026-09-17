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
    try {
      const body = await response.clone().json();
      if (body?.error?.code === 'auth/token-expired') {
        const freshToken = await authStore.forceIdTokenRefresh();
        const retryHeaders = {
          ...args.headers,
          ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}),
        };
        return tsRestFetchApi({ ...args, headers: retryHeaders });
      }
    } catch {
      // If we can't parse the response body, return original response
    }
  }

  return response;
}

/**
 * Returns the singleton ROAR API client.
 * Creates the client on first call (lazy initialization).
 *
 * @returns {ReturnType<typeof initClient>} Typed ts-rest client
 * @throws {Error} If VITE_ROAR_API_BASE_URL is not set. The error carries
 *   `code: 'config/base-url-missing'` so `isMissingBaseUrlError` can classify
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

    clientInstance = initClient(ApiContractV1, {
      baseUrl: ROAR_API_BASE_URL,
      baseHeaders: {},
      api: apiWithAuthRetry,
    });
  }

  return clientInstance;
}
