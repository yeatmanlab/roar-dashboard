import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides.ts';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { ADMINISTRATIONS_LIST_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { MaybeRef } from 'vue';

interface QueryOptions {
  enabled?: MaybeRef<boolean>;
  [key: string]: any;
}

interface Administration {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Administrations list query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryReturnType} The TanStack query result.
 */
const useAdministrationsListQuery = (
  queryOptions?: QueryOptions
): UseQueryReturnType<Administration[], Error> => {
  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => true];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.ADMINISTRATIONS, []),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationsListQuery; 