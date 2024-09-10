import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { getUserAssignments } from '@/helpers/query/assignments';
import { USER_ASSIGNMENTS_QUERY_KEY } from '@/constants/queryKeys';
/**
 * User assignments query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserAssignments = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  return useQuery({
    queryKey: [USER_ASSIGNMENTS_QUERY_KEY, roarUid.value, userQueryKeyIndex.value],
    queryFn: () => getUserAssignments(roarUid.value),
    // Refetch on window focus for MEFS assessments as those are opened in a separate tab.
    refetchOnWindowFocus: 'always',
    ...queryOptions,
  });
};

export default useUserAssignments;
