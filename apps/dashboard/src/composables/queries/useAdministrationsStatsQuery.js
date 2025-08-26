import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { fetchDocsById } from '@/helpers/query/utils';
import { ADMINISTRATIONS_STATS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Administrations stats query.
 *
 * @param {ref<Array<String>>} administrationIds – A Vue ref containing an array of administration IDs to fetch.
 * @param {ref<String>} orgId – A Vue ref containing the org ID  .
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationsStatsQuery = (administrationIds, orgId, queryOptions = undefined) => {
  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => hasArrayEntries(administrationIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);
  const statsKey = toValue(orgId) ? toValue(orgId) : 'total';

  return useQuery({
    queryKey: [ADMINISTRATIONS_STATS_QUERY_KEY, administrationIds],
    queryFn: () =>
      fetchDocsById(
        toValue(administrationIds)?.map((administrationId) => {
          return {
            collection: FIRESTORE_COLLECTIONS.ADMINISTRATIONS,
            docId: `${administrationId}/stats/${statsKey}`,
          };
        }),
      ),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationsStatsQuery;
