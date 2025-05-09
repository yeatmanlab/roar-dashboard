import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth.js';
import {
  DISTRICTS_LIST_QUERY_KEY,
  DISTRICT_SCHOOLS_QUERY_KEY,
  SCHOOL_CLASSES_QUERY_KEY,
  GROUPS_LIST_QUERY_KEY,
  ORG_MUTATION_KEY,
} from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Type definition for Organization Data.
 * @property {string} type - The Firestore collection name (e.g., 'districts', 'schools').
 * @property {string} name - The name of the organization.
 * @property {string} abbreviation - The abbreviation of the organization.
 * @property {string} [id] - Optional ID, usually present for existing orgs.
 * @property {string[]} [tags] - Optional tags for the organization.
 * @property {string} [schoolId] - The ID of the parent school (if applicable).
 * @property {string} [districtId] - The ID of the parent district (if applicable).
 * @property {string} [parentOrgId] - The ID of the parent organization (if applicable for groups).
 * @property {string} [parentOrgType] - The type of the parent organization (if applicable for groups).
 */
type OrgData = {
  type: string;
  name: string;
  abbreviation: string;
  id?: string;
  tags?: string[];
  schoolId?: string;
  districtId?: string;
  parentOrgId?: string;
  parentOrgType?: string;
};

/**
 * Type definition for the context object used in the upsert org mutation.
 */
type UpsertOrgMutationContext = {
  previousData: OrgData[] | undefined;
  queryKey: string[] | undefined;
  parentId: string | undefined;
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
      let queryKey: string[] | undefined;
      let parentId: string | undefined;

      switch (newOrgData.type) {
        case FIRESTORE_COLLECTIONS.DISTRICTS:
          queryKey = [DISTRICTS_LIST_QUERY_KEY];
          break;
        case FIRESTORE_COLLECTIONS.SCHOOLS:
          queryKey = newOrgData.districtId ? [DISTRICT_SCHOOLS_QUERY_KEY, newOrgData.districtId] : undefined;
          parentId = newOrgData.districtId;
          break;
        case FIRESTORE_COLLECTIONS.CLASSES:
          queryKey = newOrgData.schoolId ? [SCHOOL_CLASSES_QUERY_KEY, newOrgData.schoolId] : undefined;
          parentId = newOrgData.schoolId;
          break;
        case FIRESTORE_COLLECTIONS.GROUPS:
          queryKey = newOrgData.parentOrgId
            ? [GROUPS_LIST_QUERY_KEY, newOrgData.parentOrgId]
            : [GROUPS_LIST_QUERY_KEY];
          parentId = newOrgData.parentOrgId;
          break;
        default:
          console.error('Unknown org type for optimistic update:', newOrgData.type);
          return { previousData: undefined, queryKey: undefined, parentId: undefined };
      }

      if (!queryKey) {
        console.warn('Query key could not be determined for optimistic update. Org Type:', newOrgData.type);
        return { previousData: undefined, queryKey: undefined, parentId: undefined };
      }

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<OrgData[]>(queryKey);
      const optimisticOrg = { ...newOrgData, id: newOrgData.id || `temp-${Date.now()}` };

      queryClient.setQueryData<OrgData[] | undefined>(queryKey, (oldData) => {
        if (Array.isArray(oldData)) {
          const existingIndex = newOrgData.id ? oldData.findIndex(org => org.id === newOrgData.id) : -1;
          if (existingIndex > -1) {
            const updatedData = [...oldData];
            updatedData[existingIndex] = optimisticOrg;
            return updatedData;
          } else {
            return [...oldData, optimisticOrg];
          }
        }
        return [optimisticOrg];
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
      } else {
        const orgType = variables.type;
        if (orgType === FIRESTORE_COLLECTIONS.DISTRICTS) {
          queryClient.invalidateQueries({ queryKey: [DISTRICTS_LIST_QUERY_KEY] });
        }
        if (orgType === FIRESTORE_COLLECTIONS.SCHOOLS && variables.districtId) {
          queryClient.invalidateQueries({ queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, variables.districtId] });
        } else if (orgType === FIRESTORE_COLLECTIONS.SCHOOLS) {
          queryClient.invalidateQueries({ queryKey: [DISTRICT_SCHOOLS_QUERY_KEY] });
        }
        if (orgType === FIRESTORE_COLLECTIONS.CLASSES && variables.schoolId) {
          queryClient.invalidateQueries({ queryKey: [SCHOOL_CLASSES_QUERY_KEY, variables.schoolId] });
        } else if (orgType === FIRESTORE_COLLECTIONS.CLASSES) {
           queryClient.invalidateQueries({ queryKey: [SCHOOL_CLASSES_QUERY_KEY] });
        }
        if (orgType === FIRESTORE_COLLECTIONS.GROUPS && variables.parentOrgId) {
          queryClient.invalidateQueries({ queryKey: [GROUPS_LIST_QUERY_KEY, variables.parentOrgId] });
        } else if (orgType === FIRESTORE_COLLECTIONS.GROUPS) {
          queryClient.invalidateQueries({ queryKey: [GROUPS_LIST_QUERY_KEY] });
        }
      }
    },
  });
};

export default useUpsertOrgMutation; 
