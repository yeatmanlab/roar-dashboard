import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { fetchDocsById } from '@/helpers/query/utils';
import { ADMINISTRATIONS_STATS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Administrations stats query.
 *
 * @param {ref<Array<String>>} administrationIds – A Vue ref containing an array of administration IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationsStatsQuery = (administrationIds, queryOptions = undefined) => {
  return useQuery({
    queryKey: [ADMINISTRATIONS_STATS_QUERY_KEY, toValue(administrationIds)],
    queryFn: () =>
      fetchDocsById(
        toValue(administrationIds)?.map((administrationId) => {
          return {
            collection: FIRESTORE_COLLECTIONS.ADMINISTRATIONS,
            docId: `${administrationId}/stats/total`,
          };
        }),
      ),
    ...queryOptions,
  });
};

export default useAdministrationsStatsQuery;
