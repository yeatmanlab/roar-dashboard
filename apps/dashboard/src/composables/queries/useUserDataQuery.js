import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { mapUser } from '@/helpers/mappers/mapUser';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';

/**
 * User profile data query.
 *
 * Fetches a single user from the backend `GET /users/:id` endpoint and maps the response
 * into the legacy nested shape (`name`, `studentData`) via `mapUser`, so consumers are
 * unchanged from the previous Firestore-backed implementation. When `userId` is falsy the
 * current authenticated user (`authStore.roarUid`) is fetched.
 *
 * @param {string|undefined|null} userId – The user ID to fetch; a falsy value fetches the current user.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result (legacy-shaped user object).
 */
const useUserDataQuery = (userId = undefined, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const uid = computed(() => userId || roarUid.value);
  const queryConditions = [() => !!uid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, uid],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.users.get({ params: { id: uid.value } });

      if (result.status !== StatusCodes.OK) {
        // Surface non-200 ts-rest results as thrown errors so TanStack routes them through
        // `error`; carry the ts-rest response for downstream error handling.
        const error = new Error(`Failed to fetch user with status ${result.status}`);
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

export default useUserDataQuery;
