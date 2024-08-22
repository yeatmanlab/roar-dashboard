import { useQuery } from '@tanstack/vue-query';
import { DSGF_ORGS_QUERY_KEY } from '@/constants/queryKeys';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
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
  const authStore = useAuthStore();
  const { uid } = storeToRefs(authStore);

  return useQuery({
    queryKey: [DSGF_ORGS_QUERY_KEY, uid.value, administrationId],
    queryFn: () => fetchTreeOrgs(administrationId, assignedOrgs),
    ...queryOptions,
  });
};

export default useDsgfOrgQuery;
