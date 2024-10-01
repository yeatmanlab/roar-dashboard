import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { DSGF_ORGS_QUERY_KEY } from '@/constants/queryKeys';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchTreeOrgs } from '@/helpers/query/orgs';

/**
 * District School Groups Families (DSGF) Orgs query.
 *
 * @TODO: Decouple the assignedOrgs from the query parameter, ideally letting this query request that data
 * independently. This would allow the query to be more flexible and reusable, but currently not a hard requirement.
 *
 * @param {String} administrationId – The ID of the administration to fetch DSGF orgs for.
 * @param {Object} assignedOrgs – The orgs assigned to the current administration.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDsgfOrgQuery = (administrationId, assignedOrgs, queryOptions = undefined) => {
  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => !!toValue(administrationId)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DSGF_ORGS_QUERY_KEY, administrationId],
    queryFn: () => fetchTreeOrgs(administrationId, assignedOrgs),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDsgfOrgQuery;
