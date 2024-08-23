import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { orgFetcher } from '@/helpers/query/orgs';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { DISTRICTS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Districts query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictsQuery = (queryOptions = undefined) => {
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
    queryKey: [DISTRICTS_QUERY_KEY],
    queryFn: () => {
      return orgFetcher(FIRESTORE_COLLECTIONS.DISTRICTS, undefined, isSuperAdmin, administrationOrgs, [
        'name',
        'id',
        'tags',
      ]);
    },
    enabled: isQueryEnabled.value,
    ...queryOptions,
  });
};

export default useDistrictsQuery;
