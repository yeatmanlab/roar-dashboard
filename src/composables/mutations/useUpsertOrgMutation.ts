import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth.js';
import {
  DISTRICTS_LIST_QUERY_KEY,
  DISTRICT_SCHOOLS_QUERY_KEY,
  SCHOOL_CLASSES_QUERY_KEY,
  GROUPS_LIST_QUERY_KEY,
  ORG_MUTATION_KEY,
  ORGS_TABLE_QUERY_KEY,
} from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

interface OrgDataBase {
  name: string;
  id?: string; // Optional for new orgs, assigned by backend
  tags?: string[];
}

interface DistrictOrg extends OrgDataBase {
  type: typeof FIRESTORE_COLLECTIONS.DISTRICTS;
}

interface SchoolOrg extends OrgDataBase {
  type: typeof FIRESTORE_COLLECTIONS.SCHOOLS;
  districtId: string;
}

interface ClassOrg extends OrgDataBase {
  type: typeof FIRESTORE_COLLECTIONS.CLASSES;
  schoolId: string;
  districtId: string;
}

interface GroupOrg extends OrgDataBase {
  type: typeof FIRESTORE_COLLECTIONS.GROUPS;
  parentOrgId: string;
  parentOrgType?: string;
}

type OrgData = DistrictOrg | SchoolOrg | ClassOrg | GroupOrg;

type UpsertOrgMutationContext = {
  previousData: OrgData[] | undefined;
  queryKey: string[];
  parentId: string | undefined; // parentId can still be undefined if it's a district
};

/**
 * Upsert Org mutation.
 *
 * TanStack mutation to update or insert an org and optimistically update the cache.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useUpsertOrgMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation<OrgData, Error, OrgData, UpsertOrgMutationContext>({
    mutationKey: [ORG_MUTATION_KEY],
    mutationFn: async (data: OrgData): Promise<OrgData> => {
      await authStore.roarfirekit.upsertOrg(data);
      return data;
    },
    onMutate: async (newOrgData: OrgData) => {
      let queryKey: string[];
      let parentId: string | undefined;

      if (newOrgData.type === FIRESTORE_COLLECTIONS.DISTRICTS) {
        queryKey = [DISTRICTS_LIST_QUERY_KEY];
        // parentId remains undefined for districts
      } else if (newOrgData.type === FIRESTORE_COLLECTIONS.SCHOOLS) {
        queryKey = [DISTRICT_SCHOOLS_QUERY_KEY, newOrgData.districtId];
        parentId = newOrgData.districtId;
      } else if (newOrgData.type === FIRESTORE_COLLECTIONS.CLASSES) {
        queryKey = [SCHOOL_CLASSES_QUERY_KEY, newOrgData.schoolId];
        parentId = newOrgData.schoolId;
        // Note: newOrgData.districtId is also available here if needed for context
      } else if (newOrgData.type === FIRESTORE_COLLECTIONS.GROUPS) {
        queryKey = [GROUPS_LIST_QUERY_KEY, newOrgData.parentOrgId];
        parentId = newOrgData.parentOrgId;
      } else {
        // This case should ideally not be hit if OrgData is correctly typed
        // and all cases are handled. Adding an exhaustive check:
        const _exhaustiveCheck: never = newOrgData;
        console.error('Unknown org type for optimistic update:', _exhaustiveCheck);
        return {
          previousData: undefined,
          queryKey: [] as string[],
          parentId: undefined,
        } as unknown as UpsertOrgMutationContext;
        // Returning a compatible type to satisfy onMutate's expected return, though this path is an error.
        // The [] as string[] for queryKey is a placeholder for the error case.
      }

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<OrgData[]>(queryKey);
      const optimisticOrg = { ...newOrgData, id: newOrgData.id };

      queryClient.setQueryData<OrgData[]>(queryKey, (oldData) => {
        if (Array.isArray(oldData)) {
          const existingIndex = newOrgData.id ? oldData.findIndex((org) => org.id === newOrgData.id) : -1;
          if (existingIndex > -1) {
            const updatedData = [...oldData];
            updatedData[existingIndex] = optimisticOrg;
            return updatedData;
          } else {
            return [...oldData, optimisticOrg];
          }
        }
        return [optimisticOrg]; // If oldData is undefined or not an array
      });

      return { previousData, queryKey, parentId };
    },
    onError: (err, newOrgData, context) => {
      if (context?.queryKey && context.previousData !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      console.error('Error upserting org:', err, newOrgData);
    },
    onSettled: (data, error, variables, context) => {
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });

        // We need to invalidate this query otherwise a site will not show up right away in the list groups table.
        if (variables.type === FIRESTORE_COLLECTIONS.DISTRICTS) {
          console.log('invalidating orgs-table');
          queryClient.invalidateQueries({
            queryKey: [ORGS_TABLE_QUERY_KEY],
            exact: false,
          });
        }
      } else {
        // Fallback invalidation logic (should be less common if onMutate always provides context.queryKey)
        const orgType = variables.type;
        if (orgType === FIRESTORE_COLLECTIONS.DISTRICTS) {
          queryClient.invalidateQueries({
            queryKey: [DISTRICTS_LIST_QUERY_KEY],
          });
        }
        // Added type checks for variables before accessing parent IDs
        if (orgType === FIRESTORE_COLLECTIONS.SCHOOLS && (variables as SchoolOrg).districtId) {
          queryClient.invalidateQueries({
            queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, (variables as SchoolOrg).districtId],
          });
        } else if (orgType === FIRESTORE_COLLECTIONS.SCHOOLS) {
          queryClient.invalidateQueries({
            queryKey: [DISTRICT_SCHOOLS_QUERY_KEY],
          });
        }
        if (orgType === FIRESTORE_COLLECTIONS.CLASSES && (variables as ClassOrg).schoolId) {
          queryClient.invalidateQueries({
            queryKey: [SCHOOL_CLASSES_QUERY_KEY, (variables as ClassOrg).schoolId],
          });
        } else if (orgType === FIRESTORE_COLLECTIONS.CLASSES) {
          queryClient.invalidateQueries({
            queryKey: [SCHOOL_CLASSES_QUERY_KEY],
          });
        }
        if (orgType === FIRESTORE_COLLECTIONS.GROUPS && (variables as GroupOrg).parentOrgId) {
          queryClient.invalidateQueries({
            queryKey: [GROUPS_LIST_QUERY_KEY, (variables as GroupOrg).parentOrgId],
          });
        } else if (orgType === FIRESTORE_COLLECTIONS.GROUPS) {
          queryClient.invalidateQueries({ queryKey: [GROUPS_LIST_QUERY_KEY] });
        }
      }
    },
  });
};

export default useUpsertOrgMutation;
