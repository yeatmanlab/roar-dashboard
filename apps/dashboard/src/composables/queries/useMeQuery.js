import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * `/me` query.
 *
 * Calls the backend `GET /me` endpoint to fetch the authenticated user's profile
 * (id, userType, name, unsignedAgreements). This is the canonical source of
 * truth for user identity and TOS status; it replaces the Firestore-based
 * user data fetch.
 *
 * Retry policy: the query does **not** retry on `auth/rostering-ended` or
 * terminal auth errors (`auth/required`, `auth/token-expired`). Those error
 * codes are surfaced to `useGlobalError` (via the QueryCache bridge in
 * `plugins.js`) so the router can redirect to AccessEnded / SignIn / GenericError
 * pages without spinning on retries first.
 *
 * Errors thrown by this query reach the caller via the standard TanStack Query
 * `error` ref. Callers wire a watcher in `App.vue` that translates `/me` failures
 * into a global error state for the router to react to.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useMeQuery = (queryOptions = undefined) => {
  const { isQueryEnabled, options } = computeQueryOverrides([], queryOptions);

  return useQuery({
    queryKey: [ME_QUERY_KEY],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.me.get();

      if (result.status === 200) {
        return result.body.data;
      }

      // Non-200 ts-rest results are surfaced as thrown errors so TanStack
      // routes them through `error` and the QueryCache → globalError bridge.
      // The thrown shape carries the ts-rest response so `isRosteringEndedError`
      // / `isTerminalAuthError` can introspect it downstream.
      const error = new Error(`/me request failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    enabled: isQueryEnabled,
    retry: (failureCount, error) => {
      // Rostering-ended and terminal auth errors are not transient; retrying
      // wastes time and delays the user-facing error UX.
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
    ...options,
  });
};

export default useMeQuery;
