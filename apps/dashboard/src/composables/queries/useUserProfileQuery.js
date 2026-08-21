import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapUser } from '@/helpers/mappers/mapUser';
import { USER_PROFILE_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * User profile query (backend API).
 *
 * Fetches a single user from `GET /v1/users/:id` via the typed ts-rest client
 * and maps the flat, camelCased API response into the legacy nested shape the
 * dashboard's user-data consumers expect (via {@link mapUser}). This is the
 * API-backed replacement for the Firestore `useUserDataQuery` on the admin
 * user-management surface.
 *
 * Keyed on a dedicated `USER_PROFILE_QUERY_KEY` (`'user-profile'`) rather than
 * the Firestore `'user'` key so the two transports don't collide in the cache
 * while both are mounted during the migration.
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND a truthy
 * `userId`; callers can add conditions via `queryOptions.enabled`.
 *
 * @param {Ref<String>|String} userId – The user's UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the mapped user object.
 */
const useUserProfileQuery = (userId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(userId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [USER_PROFILE_QUERY_KEY, userId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.users.get({ params: { id: toValue(userId) } });

      if (result.status !== StatusCodes.OK) {
        // Non-200 ts-rest results are surfaced as thrown errors so TanStack
        // routes them through `error`. The thrown shape carries the ts-rest
        // response so downstream error handlers can introspect it.
        const error = new Error(`Failed to fetch user profile with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      // Unwrap the success envelope ({ data: <user> }) and map the flat API
      // shape to the legacy nested shape the components read.
      return mapUser(result.body.data);
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying
    // delays the user-facing error UX. Placed after `...options` so a
    // caller-supplied `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useUserProfileQuery;
