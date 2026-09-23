import { QueryCache, QueryClient } from '@tanstack/vue-query';
import { isRosteringEndedError, isTerminalAuthError, isUserNotProvisionedError } from '@/utils/api-errors';
import { useGlobalError } from '@/composables/useGlobalError';
import isTestEnv from '@/helpers/isTestEnv';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { APP_ROUTES } from '@/constants/routes';

const MAX_RETRIES = 3;

// `auth/user-not-found` means the Firebase account exists but the backend
// user record doesn't — after an SSO sign-in that is the provisioning window,
// which rostering can take a while to close. On the SSO landing page these
// retries replace the SSO-specific polling loop that previously fetched `/me`
// outside the query cache; the page shares this single, patient schedule
// (~100s: 600ms base, 1.5x growth, capped at 10s per retry).
export const PROVISIONING_MAX_RETRIES = 15;
const PROVISIONING_MAX_RETRIES_TEST = 3;
const PROVISIONING_RETRY_BASE_DELAY_MS = 600;
const PROVISIONING_RETRY_BASE_DELAY_TEST_MS = 200;
const PROVISIONING_RETRY_DELAY_MULTIPLIER = 1.5;
const PROVISIONING_RETRY_MAX_DELAY_MS = 10_000;

// TanStack's default schedule, spelled out: 1s, 2s, 4s, ... capped at 30s.
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;

/**
 * `true` while an SSO provisioning wait may legitimately be in progress.
 *
 * The patient provisioning schedule applies only then — the SSO landing page
 * renders a dedicated wait/retry UX for it. Everywhere else
 * `auth/user-not-found` settles on the generic schedule (~7s), so a
 * deprovisioned account is not parked behind the app-level spinner for the
 * full ~100s window.
 *
 * The real check is registered by `router/index.js` via
 * {@link setProvisioningContextCheck}: it derives the answer from the active
 * route's `meta.awaitsUserProvisioning` (the same flag every other
 * provisioning exemption keys off, immune to trailing slashes and new
 * flagged routes) and from `authStore.ssoProvider` (a redirect SSO return
 * fails `/me` on /signin before the flow pushes to /sso — that in-flight
 * window must be patient too). This module can't derive that itself:
 * importing the router or the auth store here would be circular. The
 * pathname comparison below is only the fallback until the router module
 * has loaded, and the default in unit tests.
 */
let provisioningContextCheck = () => window.location.pathname === APP_ROUTES.SSO;

/**
 * Register the app's provisioning-context check.
 *
 * Called once from `router/index.js`. Replaces the pathname fallback with a
 * check derived from the route table and the auth store.
 *
 * @param {() => boolean} check - Returns `true` while a provisioning wait may be in progress.
 */
export function setProvisioningContextCheck(check) {
  provisioningContextCheck = check;
}

/**
 * Shared retry policy for `/me`-backed queries.
 *
 * Rostering-ended and terminal auth errors are not transient; retrying
 * wastes time and delays the user-facing error UX. `auth/user-not-found`
 * during a provisioning wait is the opposite case: the backend hasn't
 * provisioned the user record yet (SSO rostering in flight), so it gets a
 * longer retry window than ordinary transient failures — in test environments
 * (`isTestEnv`) a shortened one, to keep E2E runs fast while still
 * exercising the provisioning path.
 *
 * Lives here (not in useMeQuery.js) so it can be pinned on the query key
 * via `setQueryDefaults` below, right where the queryClient is created —
 * every `/me` initiator gets it structurally, whatever modules it imports.
 *
 * @param {number} failureCount - Number of failed attempts so far.
 * @param {Error} error - The thrown error (carries `.status` / `.body`).
 * @returns {boolean} Whether TanStack Query should retry.
 */
export function meRetryPolicy(failureCount, error) {
  if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
    return false;
  }
  if (isUserNotProvisionedError(error) && provisioningContextCheck()) {
    // `isTestEnv` (the __E2E__ localStorage flag), not `window.Cypress` —
    // the Cypress global is not visible from the app context in some setups.
    const maxRetries = isTestEnv() ? PROVISIONING_MAX_RETRIES_TEST : PROVISIONING_MAX_RETRIES;
    return failureCount < maxRetries;
  }
  // Deterministic behavior in Cypress E2E — mirrors the queryClient's
  // default retry policy below, which this policy replaces for /me-backed
  // queries. Checks both detectors: `window.Cypress` for parity with the
  // default policy, `isTestEnv()` for the setups where the Cypress global
  // is not visible from the app context.
  if (window.Cypress || isTestEnv()) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * Retry delay companion to {@link meRetryPolicy}.
 *
 * While the user is not provisioned yet and a provisioning wait is in
 * progress, back off gently (600ms base, 1.5x growth, 10s cap) so the whole
 * retry window spans roughly 100 seconds of rostering time. Every other retryable
 * error keeps TanStack's default exponential schedule.
 *
 * @param {number} failureCount - Number of failed attempts so far (0-based at
 *   the first retry decision, matching TanStack's retryer).
 * @param {Error} error - The thrown error (carries `.status` / `.body`).
 * @returns {number} Delay in milliseconds before the next attempt.
 */
export function meRetryDelay(failureCount, error) {
  if (isUserNotProvisionedError(error) && provisioningContextCheck()) {
    const baseDelay = isTestEnv() ? PROVISIONING_RETRY_BASE_DELAY_TEST_MS : PROVISIONING_RETRY_BASE_DELAY_MS;
    return Math.min(baseDelay * PROVISIONING_RETRY_DELAY_MULTIPLIER ** failureCount, PROVISIONING_RETRY_MAX_DELAY_MS);
  }
  return Math.min(DEFAULT_RETRY_BASE_DELAY_MS * 2 ** failureCount, DEFAULT_RETRY_MAX_DELAY_MS);
}

/**
 * Singleton TanStack Query client.
 *
 * Lifted out of `plugins.js` so non-component code (the router's `beforeEach`
 * guard, in particular) can read cached query data via
 * `queryClient.getQueryData([KEY])` without going through Vue's composition
 * API. Created once at module load and consumed by:
 *
 *   - `plugins.js`, which passes it to `VueQueryPlugin`.
 *   - `router/index.js`, which inspects the `/me` cache to decide whether
 *     to redirect to the SignTos flow.
 *
 * The QueryCache's `onError` is the **single** bridge between API errors and
 * `useGlobalError`. App.vue's `meError` watcher only handles navigation; it
 * does not write to global error state. Keeping the mapping in one place
 * prevents two surfaces from competing to set or clear the same flag. The
 * SSO readiness flow (`useSSOAccountReadinessVerification`) observes the
 * same `/me` query as the rest of the app, so its errors flow through this
 * bridge too — `onError` fires only after the query's retries (including
 * the patient provisioning schedule in `meRetryPolicy`) are exhausted.
 *
 * `useGlobalError` is module-scoped (its state is a `ref` outside any
 * component), so calling it from this non-component context is safe.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const { setGlobalError } = useGlobalError();
      if (isRosteringEndedError(error)) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
        return;
      }
      if (isTerminalAuthError(error)) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
        return;
      }
      // Only treat the `/me` query as a global server error. Other queries
      // may have their own UI affordances for failure (retry buttons,
      // toasts, empty states) and shouldn't take the whole app down.
      if (Array.isArray(query?.queryKey) && query.queryKey[0] === ME_QUERY_KEY) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Cypress runs with no cache so each test starts from a fresh fetch.
      // `window.Cypress` is set by the Cypress runtime; outside of Cypress
      // we keep generous staleTime/gcTime so the dashboard doesn't refetch
      // /me et al. on every navigation.
      staleTime: window.Cypress ? 0 : 10 * 60 * 1000,
      gcTime: window.Cypress ? 0 : 15 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry on terminal auth errors (unrecoverable).
        if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
          return false;
        }
        // Deterministic behavior in Cypress E2E.
        if (window.Cypress) return false;
        return failureCount < 3;
      },
    },
  },
});

// Pin the /me retry policy on the query key itself, so fetches started
// outside a `useQuery` observer — the router guard's `ensureQueryData`,
// `resolveUserClaims`' `fetchQuery` — get the same provisioning-aware
// schedule without every initiator having to hand-attach the pair. The
// registration lives here, next to the client it configures, so it holds
// for any initiator regardless of which modules that initiator imports.
queryClient.setQueryDefaults([ME_QUERY_KEY], {
  retry: meRetryPolicy,
  retryDelay: meRetryDelay,
});
