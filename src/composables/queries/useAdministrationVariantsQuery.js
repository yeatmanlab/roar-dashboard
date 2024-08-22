import { useQuery } from '@tanstack/vue-query';
import { variantsFetcher } from '@/helpers/query/tasks';
import { ADMINITRATION_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Administration Variants query.
 *
 * @TODO: Consider separating into two queries, one for registered variants and one for all variants.
 * @TODO: Consider moving the "registered" query key to a constant.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationVariantsQuery = (registeredVariantsOnly = false, queryOptions = undefined) => {
  const queryKey = registeredVariantsOnly
    ? [ADMINITRATION_VARIANTS_QUERY_KEY, 'registered']
    : ADMINITRATION_VARIANTS_QUERY_KEY;

  return useQuery({
    queryKey,
    queryFn: () => variantsFetcher(registeredVariantsOnly),
    ...queryOptions,
  });
};

export default useAdministrationVariantsQuery;
