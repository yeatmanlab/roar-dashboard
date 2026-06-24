import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapUser } from '@/helpers/mappers/mapUser';
import { USER_STUDENT_DATA_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * User student data query.
 *
 * Returns the user (with `studentData` nested), fetched from the backend `GET /users/:id`
 * endpoint and reshaped via `mapUser`. The legacy implementation masked the Firestore doc to
 * `['studentData']`, which still returned a wrapper object (`{ id, studentData: {...} }`) — so
 * consumers read `studentData.*` off the result. We preserve that nested shape here (the Task
 * players read `studentData.dob` / `studentData.grade`), rather than returning the bare slice.
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND a truthy resolved `uid`;
 * callers can add conditions via `queryOptions.enabled`.
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

  // Gate internally on the access token so the query never fires before auth is ready, then on
  // the resolved uid. Caller conditions arrive via queryOptions.enabled and are AND'ed in.
  const queryConditions = [() => Boolean(authStore.accessToken), () => !!uid.value];
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

export default useUserStudentDataQuery;
