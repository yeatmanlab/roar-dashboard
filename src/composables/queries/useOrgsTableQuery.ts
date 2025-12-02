import { computed, Ref, ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { orgFetchAll } from '@/helpers/query/orgs';
import { ORGS_TABLE_QUERY_KEY } from '@/constants/queryKeys';
import { ORG_TYPES } from '@/constants/orgTypes';

export interface OrgItem {
  id: string;
  name: string;
  tags?: string[];
  parentOrgId?: string;
  createdBy?: string;
  creatorName?: string;
  districtId?: string;
  schoolId?: string;
  schools?: string[];
  classes?: string[];
}

/**
 * Orgs Table query.
 *
 * Fetches all orgs assigned to the current user account. This query is used by the List Orgs page and GroupPicker
 * component. Both share the same cached data.
 *
 * Firestore rules handle permission filtering, so no client-side filtering is needed.
 *
 * @param {String} activeOrgType – The active org type (district, school, etc.).
 * @param {String} selectedDistrict – The selected district ID.
 * @param {String} selectedSchool – The selected school ID.
 * @param {String} orderBy – The order by field.
 * @param {Boolean} includeCreators – Whether to fetch and include creator names (default: true).
 * @param {Object} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useOrgsTableQuery = (
  activeOrgType: Ref<string> | ComputedRef<string>,
  selectedDistrict: Ref<string | null | undefined> | ComputedRef<string | null | undefined>,
  selectedSchool: Ref<string | undefined> | ComputedRef<string | undefined>,
  orderBy: Ref<unknown>,
  includeCreators = true,
  queryOptions?: { enabled?: boolean | Ref<boolean> | ComputedRef<boolean> },
) => {
  const selectFields = computed<string[]>(() => {
    const orgType = activeOrgType.value;
    if (orgType === ORG_TYPES.GROUPS) {
      return ['id', 'name', 'tags', 'parentOrgId', 'createdBy'];
    }
    return ['id', 'name', 'tags', 'createdBy', 'districtId', 'schoolId', 'schools', 'classes'];
  });

  return useQuery({
    queryKey: [ORGS_TABLE_QUERY_KEY, activeOrgType, selectedDistrict, selectedSchool, orderBy],
    queryFn: async (): Promise<OrgItem[]> => {
      const result = await orgFetchAll(
        activeOrgType,
        selectedDistrict,
        selectedSchool,
        orderBy,
        selectFields.value,
        includeCreators,
      );
      return result as OrgItem[];
    },
    ...queryOptions,
  });
};

export default useOrgsTableQuery;
