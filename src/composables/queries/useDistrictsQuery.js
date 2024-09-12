import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { orgFetcher } from '@/helpers/query/orgs';
import { fetchDocById } from '@/helpers/query/utils';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useUserType from '@/composables/useUserType';
import { DISTRICTS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Districts query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictsQuery = (districtId = undefined, queryOptions = undefined) => {
  // Fetch the user claims.
  const { data: userClaims } = useUserClaimsQuery({
    enabled: queryOptions?.enabled ?? true,
  });

  // Get admin status and administation orgs.
  const { isSuperAdmin } = useUserType(userClaims);
  const administrationOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const queryConditions = [() => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  // Determine the query key and query function based on whether or not we fetch a specific district.
  const queryKey = !_isEmpty(districtId) ? [DISTRICTS_QUERY_KEY, districtId] : [DISTRICTS_QUERY_KEY];
  const queryFn = !_isEmpty(districtId)
    ? () => fetchDocById(FIRESTORE_COLLECTIONS.DISTRICTS, districtId)
    : () => orgFetcher(FIRESTORE_COLLECTIONS.DISTRICTS, undefined, isSuperAdmin, administrationOrgs);

  return useQuery({
    queryKey,
    queryFn,
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDistrictsQuery;
