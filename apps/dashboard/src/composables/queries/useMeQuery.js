import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { queryClient } from '@/queryClient';
import { useAuthStore } from '@/store/auth';
import isTestEnv from '@/helpers/isTestEnv';
import { isRosteringEndedError, isTerminalAuthError, isUserNotProvisionedError } from '@/utils/api-errors';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

// TanStack's default schedule, spelled out: 1s, 2s, 4s, ... capped at 30s.
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;

// `auth/user-not-found` means the Firebase account exists but the backend
// user record doesn't — after an SSO sign-in that is the provisioning window,
// which rostering can take a while to close. These retries replace the
// SSO-specific polling loop that previously fetched `/me` outside the query
// cache; the whole app now shares this single, patient schedule (~100s:
// 600ms base, 1.5x growth, capped at 10s per retry).
export const PROVISIONING_MAX_RETRIES = 15;
const PROVISIONING_MAX_RETRIES_TEST = 3;
const PROVISIONING_RETRY_BASE_DELAY_MS = 600;
const PROVISIONING_RETRY_BASE_DELAY_TEST_MS = 200;
const PROVISIONING_RETRY_DELAY_MULTIPLIER = 1.5;
const PROVISIONING_RETRY_MAX_DELAY_MS = 10_000;

/**
 * Shared retry policy for `/me`-backed queries.
 *
 * Rostering-ended and terminal auth errors are not transient; retrying
 * wastes time and delays the user-facing error UX. `auth/user-not-found` is
 * the opposite case: the backend hasn't provisioned the user record yet
 * (SSO rostering in flight), so it gets a longer retry window than ordinary
 * transient failures — in test environments (`isTestEnv`) a shortened one,
 * to keep E2E runs fast while still exercising the provisioning path.
 *
 * Used by both `useMeQuery` and `useUserClaimsQuery` (which observes the
 * same `/me` cache entry), and placed **after** `...options` in each
 * `useQuery` call so a caller-supplied `retry` can't silently override it.
 *
 * @param {number} failureCount - Number of failed attempts so far.
 * @param {Error} error - The thrown error (carries `.status` / `.body`).
 * @returns {boolean} Whether TanStack Query should retry.
 */
export function meRetryPolicy(failureCount, error) {
  if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
    return false;
  }
  if (isUserNotProvisionedError(error)) {
    // `isTestEnv` (the __E2E__ localStorage flag), not `window.Cypress` —
    // the Cypress global is not visible from the app context in some setups.
    const maxRetries = isTestEnv() ? PROVISIONING_MAX_RETRIES_TEST : PROVISIONING_MAX_RETRIES;
    return failureCount < maxRetries;
  }
  // Deterministic behavior in Cypress E2E — mirrors the queryClient's
  // default retry policy (src/queryClient.js), which this policy replaces
  // for /me-backed queries.
  if (window.Cypress) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * Retry delay companion to {@link meRetryPolicy}.
 *
 * While the user is not provisioned yet, back off gently (600ms base, 1.5x
 * growth, 10s cap) so the whole retry window spans roughly 100 seconds of
 * rostering time. Every other retryable error keeps TanStack's default
 * exponential schedule.
 *
 * @param {number} failureCount - Number of failed attempts so far (0-based at
 *   the first retry decision, matching TanStack's retryer).
 * @param {Error} error - The thrown error (carries `.status` / `.body`).
 * @returns {number} Delay in milliseconds before the next attempt.
 */
export function meRetryDelay(failureCount, error) {
  if (isUserNotProvisionedError(error)) {
    const baseDelay = isTestEnv() ? PROVISIONING_RETRY_BASE_DELAY_TEST_MS : PROVISIONING_RETRY_BASE_DELAY_MS;
    return Math.min(baseDelay * PROVISIONING_RETRY_DELAY_MULTIPLIER ** failureCount, PROVISIONING_RETRY_MAX_DELAY_MS);
  }
  return Math.min(DEFAULT_RETRY_BASE_DELAY_MS * 2 ** failureCount, DEFAULT_RETRY_MAX_DELAY_MS);
}

/**
 * Fetch the authenticated user's `/me` payload from the backend.
 *
 * Shared query function: `useMeQuery` uses it as its `queryFn`, and
 * `resolveUserClaims` runs it through `queryClient.fetchQuery` with the same
 * query key so both surfaces dedupe against one cache entry instead of
 * issuing separate raw requests.
 *
 * Non-200 ts-rest results are surfaced as thrown errors so TanStack routes
 * them through `error` and the QueryCache → globalError bridge. The thrown
 * shape carries the ts-rest response (`.status` / `.body`) so
 * `isRosteringEndedError` / `isTerminalAuthError` can introspect it downstream.
 *
 * @returns {Promise<object>} The `/me` `data` payload (id, userType, isSuperAdmin,
 *   nameFirst, nameLast, unsignedAgreements, families).
 * @throws {Error} With `.status` and `.body` attached on non-200 responses.
 */
export async function fetchMe() {
  const client = getRoarApiClient();
  const result = await client.me.get();

  if (result.status === StatusCodes.OK) {
    return result.body.data;
  }

  const error = new Error(`/me request failed with status ${result.status}`);
  error.status = result.status;
  error.body = result.body;
  throw error;
}

/**
 * `/me` query.
 *
 * Calls the backend `GET /me` endpoint to fetch the authenticated user's profile
 * (id, userType, isSuperAdmin, nameFirst, nameLast, unsignedAgreements, families).
 * This is the canonical source of truth for user identity, super-admin status,
 * and TOS status; it replaces the Firestore-based user data fetch.
 *
 * **Enablement.** The query is internally gated on `authStore.accessToken`
 * so callers don't need to wire that condition themselves — calling
 * `useMeQuery()` with no options is safe and won't fire until the auth
 * store reports a token. Callers can pass `queryOptions.enabled` to add
 * additional conditions; `computeQueryOverrides` AND's them together.
 *
 * Retry policy: the query does **not** retry on `auth/rostering-ended` or
 * terminal auth errors (`auth/required`, `auth/token-expired`). Those error
 * codes are surfaced to `useGlobalError` (via the QueryCache bridge in
 * `plugins.js`) so the router can redirect to AccessEnded / SignIn / GenericError
 * pages without spinning on retries first. `auth/user-not-found` gets the
 * opposite treatment: it marks the SSO provisioning window (Firebase account
 * exists, backend user record doesn't yet), so the query retries it patiently
 * — see {@link meRetryPolicy} / {@link meRetryDelay}.
 *
 * The non-retriable-error policy and the access-token gate are intentionally
 * placed **after** `...options` in the `useQuery` call so a caller-supplied
 * `enabled` or `retry` can't silently override them.
 *
 * Errors thrown by this query reach the caller via the standard TanStack Query
 * `error` ref. Callers wire a watcher in `App.vue` that translates `/me` failures
 * into a global error state for the router to react to.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
// Pin the retry policy on the query key itself, so /me fetches started
// outside a `useQuery` observer — the router guard's `ensureQueryData`,
// `resolveUserClaims`' `fetchQuery` — get the same provisioning-aware
// schedule without every initiator having to hand-attach the pair. A future
// initiator that forgets would otherwise silently fall back to the
// queryClient's generic 3-retry default and reintroduce the GenericError
// bounce during SSO provisioning.
queryClient.setQueryDefaults([ME_QUERY_KEY], {
  retry: meRetryPolicy,
  retryDelay: meRetryDelay,
});

const useMeQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ME_QUERY_KEY],
    queryFn: fetchMe,
    ...options,
    enabled: isQueryEnabled,
    retry: meRetryPolicy,
    retryDelay: meRetryDelay,
  });
};

export default useMeQuery;
