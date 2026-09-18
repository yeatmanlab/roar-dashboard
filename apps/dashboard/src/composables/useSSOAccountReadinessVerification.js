import { computed, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { setUser } from '@sentry/vue';
import useMeQuery from '@/composables/queries/useMeQuery';
import { useGlobalError } from '@/composables/useGlobalError';
import useSentryLogging from '@/composables/useSentryLogging';
import { useAuthStore } from '@/store/auth';
import { AUTH_LOG_MESSAGES } from '@/constants/logMessages';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { APP_ROUTE_NAMES } from '@/constants/routes';
import { redirectSignInPath } from '@/helpers/redirectSignInPath';
import { isRosteringEndedError, isTerminalAuthError, isUserNotProvisionedError } from '@/utils/api-errors';

const { logAuthEvent } = useSentryLogging();

// How long the SSO landing page waits for the Firebase token listener to
// produce an access token before concluding there is no session at all
// (deep link, stale bookmark, or an SSO redirect that never signed in).
// The token normally arrives within a couple of seconds of the redirect.
const NO_SESSION_GRACE_PERIOD_MS = 10_000;

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
 * - the success routine: Sentry identification, invalidation of everything
 *   cached during the provisioning window, clearing any stale global error,
 *   and the redirect to the user's original destination;
 * - a no-session guard: without an access token the query never fires, so a
 *   visitor who lands here signed out is routed to SignIn after a grace
 *   period instead of spinning forever;
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
  const authStore = useAuthStore();
  const { clearGlobalError } = useGlobalError();

  const { data, error, failureCount, failureReason } = useMeQuery();

  /**
   * `true` once the `/me` query has exhausted its retries on a
   * non-terminal error. Terminal errors (rostering-ended, expired token)
   * are excluded — those navigate away via App.vue's `meError` watcher, so
   * SSOAuthPage must not flash its retry UI first.
   */
  const hasError = computed(
    () => Boolean(error.value) && !isRosteringEndedError(error.value) && !isTerminalAuthError(error.value),
  );

  // No access token means the /me query is disabled and will never settle.
  // Give the Firebase token listener a grace period, then route to SignIn —
  // mirrors the old polling loop, which fetched unconditionally, exhausted
  // its retries on auth/required, and landed on SignIn.
  const noSessionTimer = setTimeout(() => {
    if (authStore.accessToken || hasRedirected) return;
    hasRedirected = true;
    logAuthEvent(AUTH_LOG_MESSAGES.SSO_SESSION_MISSING, {
      level: 'warning',
      data: { provider: 'SSO' },
    });
    router.replace({ name: APP_ROUTE_NAMES.SIGN_IN });
  }, NO_SESSION_GRACE_PERIOD_MS);
  onUnmounted(() => clearTimeout(noSessionTimer));

  // Log each retry so the provisioning wait is visible in Sentry traces.
  // Non-provisioning failures (500s, network errors) get a distinct message
  // — labeling them "not yet provisioned" would misdirect incident triage.
  watch(failureCount, (count) => {
    if (count === 0 || hasRedirected) return;
    const reason = failureReason.value;
    const message = isUserNotProvisionedError(reason)
      ? AUTH_LOG_MESSAGES.PROVISIONING_PENDING
      : AUTH_LOG_MESSAGES.SSO_READINESS_RETRY_FAILED;
    logAuthEvent(message, {
      level: 'warning',
      data: { retryCount: count, provider: 'SSO', status: reason?.status },
    });
  });

  watch(hasError, (errored) => {
    if (!errored || hasRedirected) return;
    logAuthEvent(AUTH_LOG_MESSAGES.PROVISIONING_RETRIES_EXHAUSTED, {
      level: 'error',
      data: { retryCount: failureCount.value, provider: 'SSO' },
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

      // Invalidate everything cached during the provisioning window — SSO
      // completion is a cold start, so data fetched while the user record
      // was still being created is not trustworthy. /me itself is excluded:
      // the entry that just resolved is the freshest data in the cache, and
      // refetching it immediately would be a redundant request.
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY,
      });

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
    hasError,
    retryPolling,
  };
};

export default useSSOAccountReadinessVerification;
