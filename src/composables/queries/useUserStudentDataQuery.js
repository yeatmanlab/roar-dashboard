import { useQuery, keepPreviousData } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_STUDENT_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * User student data query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserStudentDataQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { uid } = storeToRefs(authStore);

  return useQuery({
    queryKey: [USER_STUDENT_DATA_QUERY_KEY, uid.value],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, uid.value, ['studentData']),
    placeholderData: keepPreviousData,
    ...queryOptions,
  });
};

export default useUserStudentDataQuery;
