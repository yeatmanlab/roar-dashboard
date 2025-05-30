import { type MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_ADMINISTRATION_ASSIGNMENTS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * User administration assignments query.
 *
 * @param {string} userId – The user ID to fetch assignments for.
 * @param {string} administrationId – The administration ID to fetch assignments for.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserAdministrationAssignmentsQuery = (
  userId,
  administrationId,
  queryOptions?: UseQueryOptions,
): UseQueryReturnType => {
  const queryConditions = [() => !!toValue(userId), () => !!toValue(administrationId)];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_ADMINISTRATION_ASSIGNMENTS_QUERY_KEY, userId, administrationId],
    queryFn: () =>
      fetchDocById(FIRESTORE_COLLECTIONS.USERS, `${toValue(userId)}/assignments/${toValue(administrationId)}`),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserAdministrationAssignmentsQuery;
