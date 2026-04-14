/**
 * Typed ts-rest API client for the ROAR backend.
 *
 * Reads authStore.accessToken synchronously on each request.
 * Retries once on 401 auth/token-expired by forcing a token refresh.
 */
import { initClient, tsRestFetchApi } from '@ts-rest/core';
import { ApiContractV1 } from '@roar-dashboard/api-contract';
import { useAuthStore } from '@/store/auth';

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
