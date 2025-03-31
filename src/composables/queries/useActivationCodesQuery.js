import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { ACTIVATION_CODE_QUERY_KEY } from '@/constants/queryKeys';
import { getActivationCodesByOrgId } from '@/helpers/query/activationCodes';
import { toValue } from 'vue';

/**
 * Classes query.
 *
 * @param {String} orgId – The orgId to fetch activation codes for.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useActivationCodesQuery = (orgId, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const queryConditions = [() => !!toValue(orgId)];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);
  return useQuery({
    queryKey: [ACTIVATION_CODE_QUERY_KEY, orgId],
    queryFn: () => getActivationCodesByOrgId(orgId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useActivationCodesQuery;
