import { computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { setUser } from '@sentry/vue';
import useMeQuery from '@/composables/queries/useMeQuery';
import { useGlobalError } from '@/composables/useGlobalError';
import useSentryLogging from '@/composables/useSentryLogging';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';

const { logAuthEvent } = useSentryLogging();

/**
 * Verify account readiness after SSO authentication.
 *
 * After an SSO redirect the Firebase account exists before the backend user
 * record does — until rostering finishes provisioning, `/me` fails with
 * `auth/user-not-found`. This composable does **not** poll on its own: it
 * observes the canonical `/me` query (`useMeQuery`), whose shared retry
 * policy already treats `auth/user-not-found` as "still provisioning" and
 * retries it patiently (see `meRetryPolicy` / `meRetryDelay`). Because the
 * whole app shares that one query, there is no second polling loop to race
 * against the app-level `/me` gate in `App.vue`.
 *
 * What this composable adds on top of the query:
 *
 * - the success routine: Sentry identification, a blanket query
 *   invalidation, clearing any stale global error, and the redirect to the
 *   user's original destination;
 * - progress/error logging for the SSO flow; and
 * - `retryPolling`, which resets the `/me` query so SSOAuthPage's retry
 *   button restarts the provisioning wait from scratch.
 *
 * Terminal errors are not handled here. Rostering-ended and expired-token
 * failures flow through the QueryCache → globalError bridge
 * (`queryClient.js`) and App.vue's `meError` watcher, which navigate to
 * AccessEnded / SignIn exactly as they do everywhere else in the app. Only
 * the "retries exhausted" case surfaces through `hasError` / `retryPolling`,
 * because SSOAuthPage owns that error UX (the SSO route sets
 * `meta.awaitsUserProvisioning`, which excludes it from App.vue's generic
 * error redirect).
 */
const useSSOAccountReadinessVerification = () => {
  let hasRedirected = false;

  const router = useRouter();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { clearGlobalError } = useGlobalError();

  const { data, error, failureCount, failureReason } = useMeQuery();

  /** Number of failed `/me` attempts in the current fetch cycle. */
  const retryCount = computed(() => failureCount.value);

  /**
   * `true` once the `/me` query has exhausted its retries on a
   * non-terminal error. Terminal errors (rostering-ended, expired token)
   * are excluded — those navigate away via App.vue's `meError` watcher, so
   * SSOAuthPage must not flash its retry UI first.
   */
  const hasError = computed(
    () => Boolean(error.value) && !isRosteringEndedError(error.value) && !isTerminalAuthError(error.value),
  );

  // Log each retry so the provisioning wait is visible in Sentry traces.
  watch(failureCount, (count) => {
    if (count === 0 || hasRedirected) return;
    logAuthEvent(AUTH_LOG_MESSAGES.PROVISIONING_PENDING, {
      level: 'warning',
      data: { retryCount: count, provider: 'SSO', status: failureReason.value?.status },
    });
  });

  watch(hasError, (errored) => {
    if (!errored || hasRedirected) return;
    logAuthEvent(AUTH_LOG_MESSAGES.POLLING_MAX_RETRIES_EXCEEDED, {
      level: 'error',
      data: { retryCount: retryCount.value, provider: 'SSO' },
    });
  });

  // The user is provisioned the moment `/me` resolves — the backend only
  // returns a payload once the user record exists. `immediate: true` covers
  // the case where provisioning finished before this composable mounted and
  // the payload is already in the cache.
  watch(
    data,
    (me) => {
      if (!me || hasRedirected) return;
      hasRedirected = true;

      setUser({ id: me.id, userType: me.userType });
      logAuthEvent(AUTH_LOG_MESSAGES.SUCCESS, { data: { provider: 'SSO' } });

      // Blanket invalidation is intentional: SSO completion is a cold start —
      // anything cached before this point was fetched while the user record
      // was still being provisioned, so none of it is trustworthy.
      queryClient.invalidateQueries();

      // A stale global error from an earlier failed /me attempt would make
      // the router guard hijack this redirect. /me just succeeded, so clear
      // it — mirrors App.vue's meData watcher.
      clearGlobalError();

      router.push({ path: redirectSignInPath(route) });
    },
    { immediate: true },
  );

  /**
   * Restart the provisioning wait after `/me` exhausted its retries.
   *
   * Resets the `/me` query (failure count included) and refetches it for
   * every active observer — this composable's `useMeQuery` and App.vue's
   * `useCurrentUser` alike, since they share one cache entry.
   */
  const retryPolling = () => {
    clearGlobalError();
    queryClient.resetQueries({ queryKey: [ME_QUERY_KEY] });
  };

  return {
    retryCount,
    hasError,
    retryPolling,
  };
};

export default useSSOAccountReadinessVerification;
