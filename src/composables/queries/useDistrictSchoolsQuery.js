import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { orgFetcher } from '@/helpers/query/orgs';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { DISTRICT_SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * District Schools query.
 *
 * Query designed to fetch the schools of a given district.
 *
 * @param {String} districtId – The ID of the district to fetch schools for.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictSchoolsQuery = (districtId, queryOptions = undefined) => {
  // Fetch the user claims.
  const { data: userClaims, isLoading: isLoadingClaims } = useUserClaimsQuery({
    enabled: queryOptions?.enabled ?? true,
  });

  // Get admin status and administation orgs.
  // @TODO: Replace with useUserType composable once yeatmanlab/roar-dashboard/pull/751 is merged.
  const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
  const administrationOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);
  const claimsLoaded = computed(() => !isLoadingClaims.value);
  const isQueryEnabled = computed(() => claimsLoaded.value && (queryOptions?.enabled ?? true));

  return useQuery({
    queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, districtId],
    queryFn: () => orgFetcher(FIRESTORE_COLLECTIONS.SCHOOLS, districtId, isSuperAdmin, administrationOrgs),
    enabled: isQueryEnabled,
    ...queryOptions,
  });
};

export default useDistrictSchoolsQuery;
