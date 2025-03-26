import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { ACTIVATION_CODE_QUERY_KEY } from '@/constants/queryKeys';
import { activationCodeFetcher } from '@/helpers/query/activationCodes';

/**
 * Classes query.
 *
 * @param {Array} orgId – The orgId of activation codes to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useActivationCodeQuery = (orgId, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => true];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
    queryFn: () => activationCodeFetcher(orgId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useActivationCodeQuery;
