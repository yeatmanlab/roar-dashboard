import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { USER_MEMBERSHIPS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * User memberships query.
 *
 * Fetches a user's active org/class/group/family memberships from
 * `GET /v1/users/:userId/memberships` and returns the flat `items` array
 * (each `{ entityType, entityId, role, ... }`; class rows additionally carry
 * `schoolId` / `districtId` on full-access reads). The set is small and bounded,
 * so the endpoint is unpaginated.
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND a truthy
 * resolved `userId`; callers can add conditions via `queryOptions.enabled`. The
 * participant homepage gates it further so it only fires when a launch URL
 * actually needs the school/class IDs.
 *
 * @param {import('vue').MaybeRefOrGetter<String>} userId – The target user's Postgres UUID.
 * @param {Object|undefined} queryOptions – Optional TanStack query options.
 * @returns {import('@tanstack/vue-query').UseQueryReturnType} The query result resolving to the memberships array.
 */
const useUserMembershipsQuery = (userId = undefined, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(userId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [USER_MEMBERSHIPS_QUERY_KEY, userId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.users.listUserMemberships({ params: { userId: toValue(userId) } });

      if (result.status !== StatusCodes.OK) {
        // Non-200 ts-rest results are surfaced as thrown errors so TanStack routes
        // them through `error`. The thrown shape carries the ts-rest response so
        // downstream error handlers can introspect it.
        const error = new Error(`Failed to fetch user memberships with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data.items;
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying delays
    // the user-facing error UX. Placed after `...options` so a caller-supplied
    // `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useUserMembershipsQuery;
