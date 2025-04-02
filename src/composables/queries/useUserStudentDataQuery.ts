import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides.ts';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_STUDENT_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

interface QueryOptions {
  enabled?: boolean;
  [key: string]: any;
}

interface StudentData {
  studentData: any;
  birthMonth?: number;
  birthYear?: number;
}

/**
 * User student data query.
 *
 * @TODO: Evaluate wether this query can be replaced by the existing useUserDataQuery composable.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryReturnType} The TanStack query result.
 */
const useUserStudentDataQuery = (
  queryOptions?: QueryOptions
): UseQueryReturnType<StudentData, Error> => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  // Ensure all necessary data is loaded before enabling the query.
  const queryConditions = [() => !!roarUid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_STUDENT_DATA_QUERY_KEY, roarUid],
    queryFn: () => {
      if (!roarUid.value) throw new Error('User ID is required');
      return fetchDocById(FIRESTORE_COLLECTIONS.USERS, roarUid.value, ['studentData', 'birthMonth', 'birthYear']);
    },
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserStudentDataQuery;
