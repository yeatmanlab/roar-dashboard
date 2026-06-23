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
 * Returns the user (with `studentData` nested), fetched from the backend `GET /users/:id`
 * endpoint and reshaped via `mapUser`. The legacy implementation masked the Firestore doc to
 * `['studentData']`, which still returned a wrapper object (`{ id, studentData: {...} }`) — so
 * consumers read `studentData.*` off the result. We preserve that nested shape here (the Task
 * players read `studentData.dob` / `studentData.grade`), rather than returning the bare slice.
 *
 * @TODO: Evaluate whether this query can be replaced by the existing useUserDataQuery composable
 *   — both now hit the same endpoint and return the same shape.
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

      return mapUser(result.body.data);
    },
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserStudentDataQuery;
