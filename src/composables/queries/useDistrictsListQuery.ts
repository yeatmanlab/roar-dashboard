import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { orgFetcher } from '@/helpers/query/orgs';
import { DISTRICTS_LIST_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

/**
 * Districts List query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictsListQuery = (queryOptions?: UseQueryOptions): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { userClaims } = storeToRefs(authStore);
  const { isUserSuperAdmin } = authStore;

  // Get admin's administation orgs.
  const administrationOrgs = computed(() => userClaims.value?.claims?.adminOrgs);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const queryConditions = [() => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICTS_LIST_QUERY_KEY],
    queryFn: () => orgFetcher(FIRESTORE_COLLECTIONS.DISTRICTS, undefined, ref(isUserSuperAdmin()), administrationOrgs),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDistrictsListQuery;
