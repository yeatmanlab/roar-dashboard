import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides.ts';
import { hasArrayEntries } from '@/helpers/hasArrayEntries.ts';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { DISTRICTS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { MaybeRef } from 'vue';

interface QueryOptions {
  enabled?: MaybeRef<boolean>;
  [key: string]: any;
}

interface District {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Districts query.
 *
 * @param {string[]} districtIds – The array of district IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryReturnType} The TanStack query result.
 */
const useDistrictsQuery = (
  districtIds: string[], 
  queryOptions?: QueryOptions
): UseQueryReturnType<District[], Error> => {
  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => hasArrayEntries(districtIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICTS_QUERY_KEY, districtIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.DISTRICTS, districtIds),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDistrictsQuery;
