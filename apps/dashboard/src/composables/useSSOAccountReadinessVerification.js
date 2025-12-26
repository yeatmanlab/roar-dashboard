import { ref, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter, useRoute } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { setUser } from '@sentry/vue';
import { backOff } from 'exponential-backoff';
import { useAuthStore } from '@/store/auth.js';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useSentryLogging from '@/composables/useSentryLogging';
import { AUTH_USER_TYPE } from '@/constants/auth';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import isTestEnv from '@/helpers/isTestEnv';

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
 * This composable polls the user document until it is ready for use following SSO authentication.
 * The backend creates and populates the user document after SSO, which may take some time.
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
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const { data: userData, refetch: refetchUserData } = useUserDataQuery();

  setUser({ id: roarUid.value, userType: userData?.value?.userType });

  /**
   * Check if user account is ready and redirect if so.
   *
   * User is considered ready when userType exists and is not 'guest'.
   * Guest users are temporary accounts that are still being provisioned.
   *
   * @param {object|null} data - The user data to check.
   * @returns {boolean} True if user is ready and redirect was triggered.
   */
  const checkAndRedirectIfReady = (data) => {
    const userType = data?.userType;

    if (!userType || userType === AUTH_USER_TYPE.GUEST) {
      return false;
    }

    // User is ready - mark as redirected to stop any further polling.
    hasRedirected = true;

    logAuthEvent(AUTH_LOG_MESSAGES.SUCCESS, { data: { provider: 'SSO' } });

    // Invalidate all queries to ensure data is fetched freshly after the user document is ready.
    queryClient.invalidateQueries();

    router.push({ path: redirectSignInPath(route) });
    return true;
  };

  /**
   * Wait for roarUid to be available in the auth store.
   *
   * After SSO redirect, the auth store needs time to sync with Firebase and populate userClaims.
   * This function polls quickly until roarUid is available, without counting against retry attempts.
   * For new accounts where roarUid doesn't exist yet (backend provisioning), this will time out
   * and the backOff loop will handle further retries.
   *
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds.
   * @param {number} intervalMs - Polling interval in milliseconds.
   * @returns {Promise<void>}
   */
  const waitForRoarUid = async (maxWaitMs = 10000, intervalMs = 100) => {
    const startTime = Date.now();
    while (!roarUid.value && !hasRedirected && Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    // Don't throw - roarUid might legitimately not exist for new accounts being provisioned.
    // The backOff loop will handle that case with proper retries.
  };

  /**
   * Starts polling with exponential backoff to check for user readiness.
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
      // Wait for auth store to sync before starting the backOff loop.
      // This prevents wasting retry attempts on "roarUid not available" for existing accounts.
      await waitForRoarUid();

      await backOff(
        async () => {
          // Check if roarUid is available (may still be waiting for backend provisioning).
          if (!roarUid.value) {
            const error = new Error('User ID not available yet');
            error.userType = undefined;
            throw error;
          }

          // Refetch user data from the server and use the result directly.
          const { data } = await refetchUserData();

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

            // Log progress.
            if (error.userType === AUTH_USER_TYPE.GUEST) {
              logAuthEvent(AUTH_LOG_MESSAGES.USER_TYPE_GUEST, {
                level: 'warning',
                data: { retryCount: attemptNumber, provider: 'SSO' },
              });
            } else {
              logAuthEvent(AUTH_LOG_MESSAGES.USER_TYPE_MISSING, {
                level: 'warning',
                data: { retryCount: attemptNumber, provider: 'SSO', userType: error.userType },
              });
            }

            // Stop retrying if we've already redirected (e.g., component unmounted).
            return !hasRedirected;
          },
        },
      );
    } catch {
      // Max retries exceeded or unexpected error.
      if (!hasRedirected) {
        hasError.value = true;
        logAuthEvent(AUTH_LOG_MESSAGES.POLLING_MAX_RETRIES_EXCEEDED, {
          level: 'error',
          data: { retryCount: retryCount.value, provider: 'SSO' },
        });
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
