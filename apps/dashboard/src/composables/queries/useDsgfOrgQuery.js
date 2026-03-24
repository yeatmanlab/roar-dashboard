import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { DSGF_ORGS_QUERY_KEY } from '@/constants/queryKeys';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchTreeOrgs } from '@/helpers/query/orgs';

/**
 * District School Groups Families (DSGF) Orgs query.
 *
 * @param {String} administrationId – The ID of the administration to fetch DSGF orgs for.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDsgfOrgQuery = (administrationId, queryOptions = undefined) => {
  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => !!toValue(administrationId)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DSGF_ORGS_QUERY_KEY, administrationId],
    queryFn: () => fetchTreeOrgs(administrationId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDsgfOrgQuery;
