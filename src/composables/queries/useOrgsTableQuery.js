import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { orgPageFetcher } from '@/helpers/query/orgs';
import { ORGS_TABLE_QUERY_KEY } from '@/constants/queryKeys';
/**
 * Orgs Table query.
 *
 * Fetches all orgs assigned to the current user account. This query is intended to be used by the List Orgs page that
 * contains a tabbed data table with orgs (districts, schools, etc.) assigned to the user.
 *
 * @TODO: Explore the possibility of removing this query in favour of more granular queries for each org type.
 *
 * @param {String} activeOrgType – The active org type (district, school, etc.).
 * @param {String} selectedDistrict – The selected district ID.
 * @param {String} selectedSchool – The selected school ID.
 * @param {String} orderBy – The order by field.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useOrgsTableQuery = (activeOrgType, selectedDistrict, selectedSchool, orderBy, queryOptions = undefined) => {
  const { data: userClaims } = useUserClaimsQuery({ enabled: queryOptions?.enabled ?? true });

  // Get the admin status and administation orgs.
  const { isSuperAdmin } = useUserType(userClaims);
  const adminOrgs = computed(() => userClaims.value?.claims?.adminOrgs);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const queryConditions = [() => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [ORGS_TABLE_QUERY_KEY, activeOrgType, selectedDistrict, selectedSchool, orderBy],
    queryFn: () =>
      orgPageFetcher(
        activeOrgType,
        selectedDistrict,
        selectedSchool,
        orderBy,
        ref(100000),
        ref(0),
        isSuperAdmin,
        adminOrgs,
      ),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useOrgsTableQuery;
