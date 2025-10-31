import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { orgFetchAll } from '@/helpers/query/orgs';
import { ORGS_TABLE_QUERY_KEY } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

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
const useOrgsTableQuery = (
  activeOrgType: Ref<string>,
  selectedDistrict: Ref<string>,
  selectedSchool: Ref<string>,
  orderBy: Ref<any>,
  queryOptions?: UseQueryOptions,
): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { userClaims } = storeToRefs(authStore);
  const { isUserSuperAdmin } = authStore;

  const adminOrgs = computed(() => userClaims.value?.claims?.adminOrgs);

  // Determine select fields based on org type
  const selectFields = computed(() => {
    const orgType =
      typeof activeOrgType === 'function' ? activeOrgType() : (activeOrgType as any).value || activeOrgType;
    if (orgType === 'groups') {
      return ['id', 'name', 'tags', 'parentOrgId', 'createdBy'];
    }
    return ['id', 'name', 'tags', 'createdBy'];
  });

  return useQuery({
    queryKey: [ORGS_TABLE_QUERY_KEY, 'withCreators', activeOrgType, selectedDistrict, selectedSchool, orderBy],
    queryFn: () =>
      orgFetchAll(
        activeOrgType,
        selectedDistrict,
        selectedSchool,
        orderBy,
        ref(isUserSuperAdmin()),
        adminOrgs,
        selectFields.value,
        true, // includeCreators = true
      ),
    ...queryOptions,
  });
};

export default useOrgsTableQuery;
