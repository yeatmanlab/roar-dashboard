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
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';

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
 * Verify account readiness after SSO authentication.
 *
 * This composable polls the backend `/me` endpoint until the SSO user is
 * provisioned and rostered. The backend creates the user record after SSO,
 * which may take some time — until then `/me` responds with an error status
 * (surfaced by `fetchMe` as a thrown error), which counts as "not ready yet".
 * Uses exponential backoff to reduce load on the server while waiting.
 */
const useSSOAccountReadinessVerification = () => {
  const retryCount = ref(0);
  const hasError = ref(false);
  const isPolling = ref(false);
  let hasRedirected = false;

  const router = useRouter();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { setGlobalError } = useGlobalError();

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

            // Rostering-ended and terminal auth errors are not transient —
            // stop immediately instead of burning the whole backoff schedule.
            // The provisioning case stays retryable: the backend answers 401
            // `auth/user-not-found` for a not-yet-provisioned SSO user, which
            // neither helper matches.
            if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
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
        // Terminal errors route the same way the rest of the app handles them
        // (queryClient.js QueryCache onError + App.vue meError watcher). This
        // fetch bypasses the query cache, so the mapping is applied here.
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
