import { computed, ref, Ref, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { orgFetcher } from '@/helpers/query/orgs';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { DISTRICT_SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';

/**
 * District Schools query.
 *
 * Query designed to fetch the schools of a given district.
 *
 * @param {Ref<String>} districtId – A Vue ref containing the ID of the district to fetch schools for.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictSchoolsQuery = (districtId: Ref<string>, queryOptions?: UseQueryOptions): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { adminOrgs, userClaims } = storeToRefs(authStore);
  const { isUserSuperAdmin } = authStore;

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const queryConditions = [() => !!toValue(districtId), () => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  // Fields to select for the query.
  const select = ['name', 'id', 'tags', 'currentActivationCode', 'lowGrade'];

  return useQuery({
    queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, districtId],
    queryFn: () => orgFetcher(FIRESTORE_COLLECTIONS.SCHOOLS, districtId, ref(isUserSuperAdmin()), adminOrgs, select),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDistrictSchoolsQuery;
