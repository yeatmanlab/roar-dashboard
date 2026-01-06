import { computed, Ref, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { administrationPageFetcher } from '@/helpers/query/administrations';
import { ADMINISTRATIONS_LIST_QUERY_KEY } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

/**
 * Administrations list query.
 *
 * @param {ref<String>} selectedDistrictId – A Vue ref containing the selected district ID.
 * @param {ref<String>} orderBy – A Vue ref containing the field to order the query by.
 * @param {ref<Boolean>} [testAdministrationsOnly=false] – A Vue ref containing whether to fetch only test data.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationsListQuery = (
  selectedDistrictId: Ref<string>,
  orderBy: Ref<any>,
  testAdministrationsOnly = false,
  queryOptions?: UseQueryOptions,
): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { userClaims } = storeToRefs(authStore);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const queryConditions = [() => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  // Build query key, based on whether or not we only fetch test administrations.
  const queryKey = computed(() =>
    toValue(testAdministrationsOnly)
      ? [ADMINISTRATIONS_LIST_QUERY_KEY, selectedDistrictId, 'test-data', orderBy]
      : [ADMINISTRATIONS_LIST_QUERY_KEY, selectedDistrictId, orderBy],
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      const result = await administrationPageFetcher(selectedDistrictId, testAdministrationsOnly, orderBy);
      return result.sortedAdministrations;
    },
    enabled: isQueryEnabled,
    ...options,
  });
};

/**
 * Full administrations list query that returns both sorted and full administrations.
 *
 * @param {ref<String>} selectedDistrictId – A Vue ref containing the selected district ID.
 * @param {ref<String>} orderBy – A Vue ref containing the field to order the query by.
 * @param {ref<Boolean>} [testAdministrationsOnly=false] – A Vue ref containing whether to fetch only test data.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result with both sortedAdministrations and administrations.
 */
const useFullAdministrationsListQuery = (
  selectedDistrictId: Ref<string>,
  orderBy: Ref<any>,
  testAdministrationsOnly = false,
  queryOptions?: UseQueryOptions,
): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { userClaims } = storeToRefs(authStore);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const queryConditions = [() => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  // Build query key, based on whether or not we only fetch test administrations.
  const queryKey = computed(() =>
    toValue(testAdministrationsOnly)
      ? [ADMINISTRATIONS_LIST_QUERY_KEY, selectedDistrictId, 'full', 'test-data', orderBy]
      : [ADMINISTRATIONS_LIST_QUERY_KEY, selectedDistrictId, 'full', orderBy],
  );

  return useQuery({
    queryKey,
    queryFn: () => administrationPageFetcher(selectedDistrictId, testAdministrationsOnly, orderBy),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationsListQuery;
export { useFullAdministrationsListQuery };
