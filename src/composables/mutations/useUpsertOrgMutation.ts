import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import {
  DISTRICT_SCHOOLS_QUERY_KEY,
  DISTRICTS_LIST_QUERY_KEY,
  GROUPS_LIST_QUERY_KEY,
  ORG_MUTATION_KEY,
  ORGS_TABLE_QUERY_KEY,
  SCHOOL_CLASSES_QUERY_KEY,
} from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { CreateOrgType, OrgType } from '@levante-framework/levante-zod';
import { useMutation, useQueryClient } from '@tanstack/vue-query';

type UpsertOrgMutationContext = {
  previousData: OrgType[] | undefined;
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

  return useMutation<OrgType, Error, CreateOrgType, UpsertOrgMutationContext>({
    mutationKey: [ORG_MUTATION_KEY],
    mutationFn: async (data: CreateOrgType): Promise<OrgType> => {
      const response = await authStore.roarfirekit.upsertOrg(data);
      return response.data;
    },
    onMutate: async (newOrgData: CreateOrgType) => {
      let queryKey: string[];
      let parentId: string | undefined;

      switch (newOrgData.type) {
        case FIRESTORE_COLLECTIONS.CLASSES:
          queryKey = [SCHOOL_CLASSES_QUERY_KEY, newOrgData.schoolId];
          parentId = newOrgData.schoolId;
          break;

        case FIRESTORE_COLLECTIONS.DISTRICTS:
          queryKey = [DISTRICTS_LIST_QUERY_KEY];
          break;

        case FIRESTORE_COLLECTIONS.GROUPS:
          queryKey = [GROUPS_LIST_QUERY_KEY, newOrgData.parentOrgId];
          parentId = newOrgData.parentOrgId;
          break;

        case FIRESTORE_COLLECTIONS.SCHOOLS:
          queryKey = [DISTRICT_SCHOOLS_QUERY_KEY, newOrgData.districtId];
          parentId = newOrgData.districtId;
          break;

        default:
          console.error('Unknown org type for optimistic update:', newOrgData.type);

          return {
            previousData: undefined,
            queryKey: [] as string[],
            parentId: undefined,
          } as unknown as UpsertOrgMutationContext;
      }

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<OrgType[]>(queryKey);
      const optimisticOrg = { ...newOrgData, id: `temp-${Date.now()}` };

      queryClient.setQueryData<CreateOrgType[]>(queryKey, (oldData) => {
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

        // Invalidate the general orgs query used by GroupPicker in CreateAssignment
        queryClient.invalidateQueries({
          queryKey: ['orgs'],
          exact: false,
        });
      } else {
        // Fallback invalidation logic (should be less common if onMutate always provides context.queryKey)
        const orgType = variables.type;
        if (orgType === FIRESTORE_COLLECTIONS.DISTRICTS) {
          queryClient.invalidateQueries({
            queryKey: [DISTRICTS_LIST_QUERY_KEY],
          });
        }
        // Added type checks for variables before accessing parent IDs
        if (orgType === FIRESTORE_COLLECTIONS.SCHOOLS && variables.districtId) {
          queryClient.invalidateQueries({
            queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, variables.districtId],
          });
        } else if (orgType === FIRESTORE_COLLECTIONS.SCHOOLS) {
          queryClient.invalidateQueries({
            queryKey: [DISTRICT_SCHOOLS_QUERY_KEY],
          });
        }
        if (orgType === FIRESTORE_COLLECTIONS.CLASSES && variables.schoolId) {
          queryClient.invalidateQueries({
            queryKey: [SCHOOL_CLASSES_QUERY_KEY, variables.schoolId],
          });
        } else if (orgType === FIRESTORE_COLLECTIONS.CLASSES) {
          queryClient.invalidateQueries({
            queryKey: [SCHOOL_CLASSES_QUERY_KEY],
          });
        }
        if (orgType === FIRESTORE_COLLECTIONS.GROUPS && variables.parentOrgId) {
          queryClient.invalidateQueries({
            queryKey: [GROUPS_LIST_QUERY_KEY, variables.parentOrgId],
          });
        } else if (orgType === FIRESTORE_COLLECTIONS.GROUPS) {
          queryClient.invalidateQueries({ queryKey: [GROUPS_LIST_QUERY_KEY] });
        }

        // Invalidate the general orgs query used by GroupPicker in CreateAssignment
        queryClient.invalidateQueries({
          queryKey: ['orgs'],
          exact: false,
        });
      }
    },
  });
};

export default useUpsertOrgMutation;
