import { computed, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { administrationPageFetcher } from '@/helpers/query/administrations';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useUserType from '@/composables/useUserType';
import { ADMINISTRATIONS_LIST_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Administrations list query.
 *
 * @param {ref<String>} orderBy – A Vue ref containing the field to order the query by.
 * @param {ref<Boolean>} [testAdministrationsOnly=false] – A Vue ref containing whether to fetch only test data.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationsListQuery = (orderBy, testAdministrationsOnly = false, queryOptions = undefined) => {
  // Fetch the user claims.
  const { data: userClaims } = useUserClaimsQuery({
    enabled: queryOptions?.enabled ?? true,
  });

  // Get admin status and administation orgs.
  const { isSuperAdmin } = useUserType(userClaims);
  const exhaustiveAdministrationOrgs = computed(() => userClaims.value?.claims?.adminOrgs);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const queryConditions = [() => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  // Build query key, based on whether or not we only fetch test administrations.
  const queryKey = computed(() =>
    toValue(testAdministrationsOnly)
      ? [ADMINISTRATIONS_LIST_QUERY_KEY, 'test-data', orderBy]
      : [ADMINISTRATIONS_LIST_QUERY_KEY, orderBy],
  );

  return useQuery({
    queryKey,
    queryFn: () =>
      administrationPageFetcher(isSuperAdmin, exhaustiveAdministrationOrgs, testAdministrationsOnly, orderBy),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationsListQuery;
