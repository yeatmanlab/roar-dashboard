import { computed } from 'vue';
import useDistrictsQuery from '@/composables/queries/useDistrictsQuery';
import useSchoolsQuery from '@/composables/queries/useSchoolsQuery';
import useClassesQuery from '@/composables/queries/useClassesQuery';
import useGroupsQuery from '@/composables/queries/useGroupsQuery';
import useFamiliesQuery from '@/composables/queries/useFamiliesQuery';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';

/**
 * Org Query
 *
 * Query composable for fetching org data based on a dynamic org type.
 *
 * @param {string} orgType – The org type to query.
 * @param {string} orgIds – The array of org IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
export default function useOrgQuery(orgType, orgIds, queryOptions = undefined) {
  queryOptions = { enabled: true, ...queryOptions };

  const orgQuery = computed(() => {
    switch (orgType) {
      case SINGULAR_ORG_TYPES.DISTRICTS:
        return useDistrictsQuery(orgIds, queryOptions);
      case SINGULAR_ORG_TYPES.SCHOOLS:
        return useSchoolsQuery(orgIds, queryOptions);
      case SINGULAR_ORG_TYPES.CLASSES:
        return useClassesQuery(orgIds, queryOptions);
      case SINGULAR_ORG_TYPES.GROUPS:
        return useGroupsQuery(orgIds, queryOptions);
      case SINGULAR_ORG_TYPES.FAMILIES:
        return useFamiliesQuery(orgIds, queryOptions);
      default:
        throw new Error(`Unsupported org type: ${orgType}`);
    }
  });

  return orgQuery.value;
}
