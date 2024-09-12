import { useQuery } from '@tanstack/vue-query';
import { fetchDocsById } from '@/helpers/query/utils';
import { ADMINISTRATIONS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Administrations query.
 *
 * @param {ref<Array<String>>} administrationIds – A Vue ref containing an array of administration IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationsQuery = (administrationIds, queryOptions = undefined) => {
  return useQuery({
    queryKey: [ADMINISTRATIONS_QUERY_KEY, administrationIds],
    queryFn: () =>
      fetchDocsById(
        administrationIds?.value.map((administrationId) => {
          return {
            collection: FIRESTORE_COLLECTIONS.ADMINISTRATIONS,
            docId: administrationId,
            select: ['name', 'publicName', 'sequential', 'assessments', 'legal'],
          };
        }),
      ),
    ...queryOptions,
  });
};

export default useAdministrationsQuery;
