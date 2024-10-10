import { useQuery } from '@tanstack/vue-query';
import { fetchUsersByOrg } from '@/helpers/query/users';
import { ORG_USERS_QUERY_KEY } from '@/constants/queryKeys';
/**
 * Organisation Users query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useOrgUsersQuery = (orgType, orgId, page, orderBy, queryOptions = undefined) => {
  const itemsPerPage = 1000000; // @TODO: Replace with a more reasonable value.

  return useQuery({
    queryKey: [ORG_USERS_QUERY_KEY, orgType, orgId, page, orderBy],
    queryFn: () => fetchUsersByOrg(orgType, orgId, itemsPerPage, page, orderBy),
    ...queryOptions,
  });
};

export default useOrgUsersQuery;
