import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { mapUser } from '@/helpers/mappers/mapUser';
import { USER_STUDENT_DATA_QUERY_KEY } from '@/constants/queryKeys';

/**
 * User student data query.
 *
 * Returns just the `studentData` slice of a user, fetched from the backend `GET /users/:id`
 * endpoint and reshaped via `mapUser` (mirroring the legacy `['studentData']` subfield read).
 *
 * @TODO: Evaluate whether this query can be replaced by the existing useUserDataQuery composable
 *   with a `select` — both now hit the same endpoint.
 *
 * @param {String|undefined} userId – If passed, return the studentData for that user; otherwise
 *                                    the current authenticated user.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result (the user's `studentData`).
 */
const useUserStudentDataQuery = (userId = undefined, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);
  const uid = computed(() => userId || roarUid.value);

  // Ensure all necessary data is loaded before enabling the query.
  const queryConditions = [() => !!uid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_STUDENT_DATA_QUERY_KEY, uid],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.users.get({ params: { id: uid.value } });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to fetch user student data with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return mapUser(result.body.data)?.studentData ?? null;
    },
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserStudentDataQuery;
