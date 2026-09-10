import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Shared retry policy for `/me`-backed queries.
 *
 * Rostering-ended and terminal auth errors are not transient; retrying
 * wastes time and delays the user-facing error UX. Used by both `useMeQuery`
 * and `useUserClaimsQuery` (which observes the same `/me` cache entry), and
 * placed **after** `...options` in each `useQuery` call so a caller-supplied
 * `retry` can't silently override it.
 *
 * @param {number} failureCount - Number of failed attempts so far.
 * @param {Error} error - The thrown error (carries `.status` / `.body`).
 * @returns {boolean} Whether TanStack Query should retry.
 */
export function meRetryPolicy(failureCount, error) {
  if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
    return false;
  }
  // Deterministic behavior in Cypress E2E — mirrors the queryClient's
  // default retry policy (src/queryClient.js), which this policy replaces
  // for /me-backed queries.
  if (window.Cypress) return false;
  return failureCount < MAX_RETRIES;
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
 * @returns {Promise<object>} The `/me` `data` payload (id, userType, name, unsignedAgreements).
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
 * (id, userType, name, unsignedAgreements). This is the canonical source of
 * truth for user identity and TOS status; it replaces the Firestore-based
 * user data fetch.
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
 * pages without spinning on retries first.
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
  });
};

export default useMeQuery;
