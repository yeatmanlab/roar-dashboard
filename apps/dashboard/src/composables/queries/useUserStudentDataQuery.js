import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_STUDENT_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { computed } from 'vue';

/**
 * User student data query.
 *
 * @TODO: Evaluate wether this query can be replaced by the existing useUserDataQuery composable.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @param {String|undefined} userId – If this is passed in, return the studentData for the student under this adminUid.
 *                                    If undefined, query will return the data for the current authenticated user
 * @returns {UseQueryResult} The TanStack query result.
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
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, uid.value, ['studentData']),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserStudentDataQuery;
