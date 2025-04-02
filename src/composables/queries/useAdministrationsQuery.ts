import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides.ts';
import { hasArrayEntries } from '@/helpers/hasArrayEntries.ts';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { ADMINISTRATIONS_QUERY_KEY } from '@/constants/queryKeys';
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
 * Administrations query.
 *
 * @param {string[]} administrationIds – The array of administration IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryReturnType} The TanStack query result.
 */
const useAdministrationsQuery = (
  administrationIds: string[], 
  queryOptions?: QueryOptions
): UseQueryReturnType<Administration[], Error> => {
  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => hasArrayEntries(administrationIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATIONS_QUERY_KEY, administrationIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.ADMINISTRATIONS, administrationIds),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationsQuery; 