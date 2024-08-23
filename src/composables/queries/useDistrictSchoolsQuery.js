import { computed, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { orgFetcher } from '@/helpers/query/orgs';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { DISTRICT_SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * District Schools query.
 *
 * Query designed to fetch the schools of a given district.
 *
 * @param {Ref<String>} districtId – A Vue ref containing the ID of the district to fetch schools for.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictSchoolsQuery = (districtId, queryOptions = undefined) => {
  // Fetch the user claims.
  const { data: userClaims } = useUserClaimsQuery({
    enabled: queryOptions?.enabled ?? true,
  });

  // Get admin status and administation orgs.
  // @TODO: Replace with useUserType composable once yeatmanlab/roar-dashboard/pull/751 is merged.
  const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
  const administrationOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const isQueryEnabled = computed(() => !!toValue(districtId) && claimsLoaded.value && (queryOptions?.enabled ?? true));

  return useQuery({
    queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, districtId],
    queryFn: () => orgFetcher(FIRESTORE_COLLECTIONS.SCHOOLS, districtId, isSuperAdmin, administrationOrgs),
    enabled: isQueryEnabled,
    ...queryOptions,
  });
};

export default useDistrictSchoolsQuery;
