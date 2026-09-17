import { ref, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { setUser } from '@sentry/vue';
import { backOff } from 'exponential-backoff';
import { fetchMe } from '@/composables/queries/useMeQuery';
import { useGlobalError } from '@/composables/useGlobalError';
import useSentryLogging from '@/composables/useSentryLogging';
import { AUTH_USER_TYPE } from '@/constants/auth';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { APP_ROUTE_NAMES } from '@/constants/routes';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import isTestEnv from '@/helpers/isTestEnv';
import { API_ERROR_CODES, getApiErrorCode, isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';

const { logAuthEvent } = useSentryLogging();

/**
 * Get backoff configuration for polling.
 * Uses fewer attempts when running in Cypress to speed up tests.
 */
const getBackoffOptions = () => ({
  numOfAttempts: isTestEnv() ? 3 : 15,
  startingDelay: isTestEnv() ? 200 : 600,
  timeMultiple: 1.5,
  delayFirstAttempt: false,
});

/**
 * `true` when the error is a 401 with code `auth/token-expired` — the API
 * client's built-in refresh-and-retry has already failed by the time this
 * surfaces, so it is never transient.
 */
const isTokenExpiredError = (error) => getApiErrorCode(error) === API_ERROR_CODES.AUTH_TOKEN_EXPIRED;

/**
 * Verify account readiness after SSO authentication.
 *
 * This composable polls the backend `/me` endpoint until the SSO user is
 * provisioned and rostered. The backend creates the user record after SSO,
 * which may take some time — until then `/me` responds with an error status
 * (surfaced by `fetchMe` as a thrown error), which counts as "not ready yet".
 * Uses exponential backoff to reduce load on the server while waiting.
 *
 * Rostering-ended and expired-token errors stop polling immediately and
 * route the user away (AccessEnded / SignIn) via the global error state,
 * matching how the rest of the app treats these errors. Only the "still
 * provisioning" and "max retries exceeded" cases surface through
 * `hasError` / `retryPolling`.
 */
const useSSOAccountReadinessVerification = () => {
  const retryCount = ref(0);
  const hasError = ref(false);
  const isPolling = ref(false);
  let hasRedirected = false;

  const router = useRouter();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { setGlobalError, clearGlobalError } = useGlobalError();

  /**
   * Check if the user account is ready and redirect if so.
   *
   * The user is considered ready when `/me` resolves with a userType that is
   * not 'guest'. Guest users are temporary accounts still being provisioned.
   *
   * @param {object|null} data - The `/me` data payload to check.
   * @returns {boolean} True if user is ready and redirect was triggered.
   */
  const checkAndRedirectIfReady = (data) => {
    const userType = data?.userType;

    if (!userType || userType === AUTH_USER_TYPE.GUEST) {
      return false;
    }

    // User is ready - mark as redirected to stop any further polling.
    hasRedirected = true;

    setUser({ id: data.id, userType });
    logAuthEvent(AUTH_LOG_MESSAGES.SUCCESS, { data: { provider: 'SSO' } });

    // Seed the /me cache with the fresh payload, then invalidate all queries.
    // The blanket invalidation is intentional: SSO completion is a cold start —
    // anything cached before this point was fetched while the user record was
    // still being provisioned, so none of it is trustworthy.
    queryClient.setQueryData([ME_QUERY_KEY], data);
    queryClient.invalidateQueries();

    // A stale global error from an earlier failed /me attempt (e.g. the
    // app-level useMeQuery erroring while the user was still provisioning)
    // would make the router guard hijack this redirect. /me just succeeded,
    // so clear it — mirrors App.vue's meData watcher.
    clearGlobalError();

    router.push({ path: redirectSignInPath(route) });
    return true;
  };

  /**
   * Starts polling `/me` with exponential backoff to check for user readiness.
   * Will retry up to the configured max attempts before setting hasError.
   *
   * @returns {Promise<void>}
   */
  const startPolling = async () => {
    // Prevent multiple concurrent polling sessions.
    if (isPolling.value) {
      return;
    }

    isPolling.value = true;
    hasError.value = false;

    try {
      await backOff(
        async () => {
          // Fetch /me directly. While the backend is still provisioning the
          // SSO user, this throws (401/404), which triggers a retry.
          const data = await fetchMe();

          if (checkAndRedirectIfReady(data)) {
            // Success - returning normally will exit backOff.
            return;
          }

          // Not ready yet - throw to trigger retry.
          const error = new Error('User not ready');
          error.userType = data?.userType;
          throw error;
        },
        {
          ...getBackoffOptions(),
          retry: (error, attemptNumber) => {
            // Update retry count for UI/logging.
            retryCount.value = attemptNumber;

            // Rostering-ended and expired-token errors are not transient —
            // stop immediately instead of burning the whole backoff schedule.
            // Two 401 codes deliberately stay retryable: `auth/user-not-found`
            // (the backend hasn't provisioned the SSO user yet), and
            // `auth/required` (the request went out without a token — right
            // after the SSO redirect the first attempts can race the Firebase
            // token listener that populates the store's accessToken).
            if (isRosteringEndedError(error) || isTokenExpiredError(error)) {
              return false;
            }

            // Log progress.
            if (error.userType === AUTH_USER_TYPE.GUEST) {
              logAuthEvent(AUTH_LOG_MESSAGES.USER_TYPE_GUEST, {
                level: 'warning',
                data: { retryCount: attemptNumber, provider: 'SSO' },
              });
            } else {
              logAuthEvent(AUTH_LOG_MESSAGES.USER_TYPE_MISSING, {
                level: 'warning',
                data: { retryCount: attemptNumber, provider: 'SSO', userType: error.userType, status: error.status },
              });
            }

            // Stop retrying if we've already redirected (e.g., component unmounted).
            return !hasRedirected;
          },
        },
      );
    } catch (error) {
      if (!hasRedirected) {
        // Terminal errors reproduce what the rest of the app does in two
        // places: the QueryCache onError bridge (global error state) and the
        // App.vue meError watcher (navigation). This fetch bypasses the query
        // cache, so neither surface sees the error — both halves are applied
        // here. Navigation alone is not enough (the router guard bounces
        // error pages back to Home when no global error is set), and state
        // alone is not enough either (the guard only runs on navigation, and
        // nothing else navigates away from the SSO landing page).
        if (isRosteringEndedError(error)) {
          hasRedirected = true;
          setGlobalError({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
          router.replace({ name: APP_ROUTE_NAMES.ACCESS_ENDED });
        } else if (isTerminalAuthError(error)) {
          hasRedirected = true;
          setGlobalError({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
          router.replace({ name: APP_ROUTE_NAMES.SIGN_IN });
        } else {
          // Max retries exceeded or unexpected error — show the retryable
          // error state on SSOAuthPage.
          hasError.value = true;
          logAuthEvent(AUTH_LOG_MESSAGES.POLLING_MAX_RETRIES_EXCEEDED, {
            level: 'error',
            data: { retryCount: retryCount.value, provider: 'SSO' },
          });
        }
      }
    } finally {
      isPolling.value = false;
    }
  };

  /**
   * Retry polling after an error. Resets error state and retry count.
   */
  const retryPolling = () => {
    hasError.value = false;
    retryCount.value = 0;
    startPolling();
  };

  onUnmounted(() => {
    // Signal to stop polling if still in progress.
    hasRedirected = true;
  });

  return {
    retryCount,
    hasError,
    startPolling,
    retryPolling,
  };
};

export default useSSOAccountReadinessVerification;
